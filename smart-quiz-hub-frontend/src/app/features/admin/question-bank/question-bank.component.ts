import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { DatePipe } from '@angular/common';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { TableHeaderCellComponent } from '../../../shared/components/table-header-cell/table-header-cell.component';
import { ButtonDirective } from '../../../shared/components/button/button.directive';
import { applyFilters, distinctOptions, SortState } from '../../../shared/utils/table-ops';
import { mcqColumnValue, STATUS_FILTER_OPTIONS, DIFFICULTY_FILTER_OPTIONS, toBackendSortField } from '../../../shared/utils/mcq-columns';
import { statusBadgeClass, difficultyBadgeClass } from '../../../shared/utils/badge';
import { McqService } from '../../../core/services/mcq.service';
import { ReviewService } from '../../../core/services/review.service';
import { AdminService } from '../../../core/services/admin.service';
import { StackService } from '../../../core/services/stack.service';
import { SnackService } from '../../../core/services/snack.service';
import { McqResponse, McqStatus, Difficulty, StackSummary } from '../../../core/models';
import { AssignReviewerDialogComponent } from './assign-reviewer-dialog.component';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { AiGenerateDialogComponent } from '../../questions/ai-generate-dialog/ai-generate-dialog.component';
import { QuestionFormComponent } from '../../questions/question-form/question-form.component';

@Component({
  selector: 'app-question-bank',
  standalone: true,
  imports: [
    MatButtonModule, MatIconModule, MatDialogModule, MatTooltipModule,
    MatInputModule, FormsModule, DatePipe, RelativeTimePipe,
    TableHeaderCellComponent, ButtonDirective
  ],
  templateUrl: './question-bank.component.html',
})
export class QuestionBankComponent implements OnInit, OnDestroy {
  private mcqSvc    = inject(McqService);
  private reviewSvc = inject(ReviewService);
  private adminSvc  = inject(AdminService);
  private stackSvc  = inject(StackService);
  private dialog    = inject(MatDialog);
  private snack     = inject(SnackService);
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private confirm   = inject(ConfirmService);

  // Server-driven page state. `pageRows` is the raw server page; `rows` applies the
  // creator/reviewer current-page filters the backend does not support.
  private pageRows = signal<McqResponse[]>([]);
  stacks   = signal<StackSummary[]>([]);
  loading  = signal(true);
  page     = signal(0);
  pageSize = signal(10);
  totalElements = signal(0);
  totalPages    = computed(() => Math.max(1, Math.ceil(this.totalElements() / this.pageSize())));

  sort    = signal<SortState>({ key: 'updated', dir: 'desc' });
  filters = signal<Record<string, string | null>>({
    status: null, difficulty: null, stack: null, creator: null, reviewer: null
  });

  selectedIds = signal<Set<number>>(new Set());
  selectionCount = computed(() => this.selectedIds().size);

  searchQuery = signal('');

  readonly value = mcqColumnValue;
  readonly statusOptions = STATUS_FILTER_OPTIONS;
  readonly difficultyOptions = DIFFICULTY_FILTER_OPTIONS;
  readonly statusBadge = statusBadgeClass;
  readonly diffBadge = difficultyBadgeClass;

  // Stack options come from the stacks list; creator/reviewer options are derived
  // from the current page only (the backend cannot filter by them — see report).
  stackOptions    = computed(() => this.stacks().map(s => ({ value: s.stackName, label: s.stackName })));
  creatorOptions  = computed(() => distinctOptions(this.pageRows(), mcqColumnValue, 'creator'));
  reviewerOptions = computed(() => distinctOptions(this.pageRows(), mcqColumnValue, 'reviewer'));

  /** Current page rows after applying the client-only creator/reviewer filters. */
  rows = computed(() => {
    const f = this.filters();
    return applyFilters(this.pageRows(), { creator: f['creator'], reviewer: f['reviewer'] }, mcqColumnValue);
  });

  activeFilterCount = computed(() => Object.values(this.filters()).filter(v => v != null).length);

  /** Assignable (READY/UNDER) questions on the visible page. */
  selectableQuestions = computed(() =>
    this.rows().filter(q => q.status === 'READY_FOR_REVIEW' || q.status === 'UNDER_REVIEW'));

  allSelectableSelected = computed(() => {
    const sel = this.selectedIds();
    const selectable = this.selectableQuestions();
    return selectable.length > 0 && selectable.every(q => sel.has(q.id));
  });

  private searchInput$ = new Subject<string>();
  private subs = new Subscription();

  ngOnInit(): void {
    this.stackSvc.getStacks().subscribe(r => this.stacks.set(r.data));

    this.subs.add(
      this.searchInput$.pipe(debounceTime(350), distinctUntilChanged()).subscribe(value => {
        this.searchQuery.set(value);
        this.page.set(0);
        this.syncUrl();
        this.load();
      })
    );

    // Restore state from the URL (copy-pasteable).
    const qp = this.route.snapshot.queryParamMap;
    this.filters.set({
      status: qp.get('status'), difficulty: qp.get('difficulty'), stack: qp.get('stack'),
      creator: qp.get('creator'), reviewer: qp.get('reviewer'),
    });
    const sortKey = qp.get('sort');
    if (sortKey) this.sort.set({ key: sortKey, dir: qp.get('dir') === 'asc' ? 'asc' : 'desc' });
    const page = Number(qp.get('page'));
    if (page > 0) this.page.set(page);
    const q = qp.get('q') ?? qp.get('search');
    if (q) this.searchQuery.set(q);

    this.load();
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  private syncUrl(): void {
    const f = this.filters();
    const s = this.sort();
    const isDefaultSort = s.key === 'updated' && s.dir === 'desc';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: f['status'], difficulty: f['difficulty'], stack: f['stack'],
        creator: f['creator'], reviewer: f['reviewer'],
        sort: isDefaultSort ? null : s.key,
        dir:  isDefaultSort ? null : s.dir,
        page: this.page() > 0 ? this.page() : null,
        search: this.searchQuery() || null,
        q: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Resolve the selected stack-name filter to its id for the server query. */
  private selectedStackId(): number | undefined {
    const name = this.filters()['stack'];
    return name ? this.stacks().find(s => s.stackName === name)?.id : undefined;
  }

  load(): void {
    this.loading.set(true);
    this.selectedIds.set(new Set());
    const f = this.filters();
    const s = this.sort();
    this.mcqSvc.getAllQuestions({
      status: (f['status'] as McqStatus | null) ?? undefined,
      stackId: this.selectedStackId(),
      difficulty: (f['difficulty'] as Difficulty | null) ?? undefined,
      search: this.searchQuery() || undefined,
      sort: toBackendSortField(s.key),
      direction: s.dir,
      page: this.page(),
      size: this.pageSize(),
    }).subscribe({
      next: res => {
        this.pageRows.set(res.data.content);
        this.totalElements.set(res.data.totalElements);
        this.page.set(res.data.page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  setSort(s: SortState): void { this.sort.set(s); this.page.set(0); this.syncUrl(); this.load(); }
  setFilter(key: string, value: string | null): void {
    this.filters.update(f => ({ ...f, [key]: value }));
    this.page.set(0);
    this.syncUrl();
    // creator/reviewer are client-only filters over the current page — no reload needed.
    if (key !== 'creator' && key !== 'reviewer') this.load();
  }
  clearFilters(): void {
    this.filters.set({ status: null, difficulty: null, stack: null, creator: null, reviewer: null });
    this.page.set(0);
    this.syncUrl();
    this.load();
  }

  prevPage(): void { if (this.page() > 0) { this.page.update(p => p - 1); this.syncUrl(); this.load(); } }
  nextPage(): void { if (this.page() < this.totalPages() - 1) { this.page.update(p => p + 1); this.syncUrl(); this.load(); } }

  toggleSelect(id: number): void {
    this.selectedIds.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  toggleSelectAll(): void {
    if (this.allSelectableSelected()) {
      this.selectedIds.set(new Set());
    } else {
      this.selectedIds.set(new Set(this.selectableQuestions().map(q => q.id)));
    }
  }

  clearSelection(): void { this.selectedIds.set(new Set()); }

  /** Bulk-approve all selected questions that are under review. */
  bulkApprove(): void {
    const ids = [...this.selectedIds()];
    this.confirm.ask({
      title: `Approve ${ids.length} question${ids.length !== 1 ? 's' : ''}?`,
      message: 'Selected questions that are under review will be approved. Others are skipped.',
      confirmText: 'Approve', variant: 'primary', icon: 'check_circle',
    }).then(ok => {
      if (!ok) return;
      this.reviewSvc.bulkDecision(ids, 'APPROVED').subscribe({
        next: r => {
          const d = r.data;
          this.snack.success(d.skipped > 0 ? `Approved ${d.processed}, skipped ${d.skipped}` : `${d.processed} approved`);
          this.clearSelection();
          this.load();
        },
        error: err => this.snack.error(err.error?.message ?? 'Bulk approve failed'),
      });
    });
  }

  /** Bulk-delete all selected questions (server enforces which are deletable). */
  bulkDelete(): void {
    const ids = [...this.selectedIds()];
    this.confirm.ask({
      title: `Delete ${ids.length} question${ids.length !== 1 ? 's' : ''}?`,
      message: 'This permanently removes the selected questions. This cannot be undone.',
      confirmText: 'Delete', variant: 'danger', icon: 'delete',
    }).then(ok => {
      if (!ok) return;
      let remaining = ids.length, deleted = 0;
      const tick = () => {
        if (--remaining === 0) {
          this.snack.success(`Deleted ${deleted} of ${ids.length}`);
          this.clearSelection();
          this.load();
        }
      };
      ids.forEach(id => this.mcqSvc.deleteQuestion(id).subscribe({
        next: () => { deleted++; tick(); },
        error: () => tick(),
      }));
    });
  }

  /** Single-question assign or reassign */
  openAssignReviewer(q: McqResponse): void {
    this.adminSvc.getSmesByStack(q.stackId).subscribe(res => {
      const ref = this.dialog.open(AssignReviewerDialogComponent, {
        data: { question: q, smes: res.data }, maxWidth: '500px', width: '100%'
      });
      ref.afterClosed().subscribe(reviewerId => {
        if (reviewerId) {
          this.reviewSvc.assignReviewer(q.id, { reviewerId }).subscribe({
            next: () => {
              this.snack.success(q.status === 'UNDER_REVIEW' ? 'Reviewer reassigned' : 'Reviewer assigned');
              this.load();
            },
            error: err => this.snack.error(err.error?.message ?? 'Failed to assign')
          });
        }
      });
    });
  }

  /** Bulk assign to all selected */
  openBulkAssign(): void {
    const ids = [...this.selectedIds()];
    this.adminSvc.getAllSmes().subscribe(res => {
      const ref = this.dialog.open(AssignReviewerDialogComponent, {
        data: { bulkCount: ids.length, smes: res.data }, maxWidth: '500px', width: '100%'
      });
      ref.afterClosed().subscribe(reviewerId => {
        if (reviewerId) {
          this.reviewSvc.bulkAssignReviewer({ questionIds: ids, reviewerId }).subscribe({
            next: r => {
              const d = r.data;
              this.snack.success(d.skipped > 0
                ? `Assigned ${d.assigned}, skipped ${d.skipped}`
                : `${d.assigned} question${d.assigned !== 1 ? 's' : ''} assigned`);
              this.load();
            },
            error: err => this.snack.error(err.error?.message ?? 'Bulk assign failed')
          });
        }
      });
    });
  }

  openView(q: McqResponse): void {
    window.open('/questions/' + q.id, '_blank');
  }

  openEdit(q: McqResponse): void {
    const ref = this.dialog.open(QuestionFormComponent, { data: { question: q }, maxWidth: '780px', width: '100%' });
    ref.afterClosed().subscribe(result => { if (result) this.load(); });
  }

  delete(q: McqResponse): void {
    this.confirm.ask({
      title: 'Delete question?',
      message: `"${q.questionStem.slice(0, 100)}${q.questionStem.length > 100 ? '…' : ''}"\n\nThis cannot be undone.`,
      confirmText: 'Delete', variant: 'danger', icon: 'delete',
    }).then(ok => {
      if (!ok) return;
      this.mcqSvc.deleteQuestion(q.id).subscribe({
        next: () => { this.snack.success('Question deleted'); this.load(); },
        error: err => this.snack.error(err.error?.message ?? 'Delete failed')
      });
    });
  }

  openAiGenerate(): void {
    const ref = this.dialog.open(AiGenerateDialogComponent, { maxWidth: '600px', width: '100%' });
    ref.afterClosed().subscribe(result => { if (result) this.load(); });
  }

  /** Debounced search as the user types (server-side via the list endpoint). */
  onSearchInput(value: string): void { this.searchInput$.next(value); }

  /** Immediate search (Search button / Enter). */
  search(): void {
    this.page.set(0);
    this.syncUrl();
    this.load();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.page.set(0);
    this.syncUrl();
    this.load();
  }

  autoAssign(): void {
    this.reviewSvc.autoAssignReviewers().subscribe({
      next: (r: any) => { this.snack.success(r.message ?? 'Auto-assign complete'); this.load(); },
      error: (err: any) => this.snack.error(err.error?.message ?? 'Auto-assign failed')
    });
  }

  exportXlsx(): void {
    const f = this.filters();
    const stackId = this.selectedStackId();
    const status = (f['status'] as McqStatus | null) ?? 'APPROVED';
    const difficulty = (f['difficulty'] as Difficulty | null) ?? undefined;
    this.mcqSvc.exportQuestions({ stackId, status, difficulty }).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'questions.xlsx'; a.click();
      URL.revokeObjectURL(url);
    });
  }

  truncate(text: string, max = 55): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  statusLabel(status: McqStatus): string {
    return status.replaceAll('_', ' ');
  }
}
