import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatePipe } from '@angular/common';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { McqService } from '../../../core/services/mcq.service';
import { StackService } from '../../../core/services/stack.service';
import { SnackService } from '../../../core/services/snack.service';
import { McqResponse, McqStatus, Difficulty, StackSummary } from '../../../core/models';
import { QuestionFormComponent } from '../question-form/question-form.component';
import { AiGenerateDialogComponent } from '../ai-generate-dialog/ai-generate-dialog.component';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { TableHeaderCellComponent } from '../../../shared/components/table-header-cell/table-header-cell.component';
import { ButtonDirective } from '../../../shared/components/button/button.directive';
import { CountUpDirective } from '../../../shared/directives/count-up.directive';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FilterOption, SortState } from '../../../shared/utils/table-ops';
import { STATUS_FILTER_OPTIONS, DIFFICULTY_FILTER_OPTIONS, toBackendSortField } from '../../../shared/utils/mcq-columns';
import { statusBadgeClass, difficultyBadgeClass, statusLabel } from '../../../shared/utils/badge';

@Component({
  selector: 'app-my-questions',
  standalone: true,
  imports: [
    MatButtonModule, MatIconModule, MatMenuModule, MatDialogModule, MatTooltipModule,
    DatePipe, RelativeTimePipe, TableHeaderCellComponent, ButtonDirective, CountUpDirective
  ],
  templateUrl: './my-questions.component.html',
})
export class MyQuestionsComponent implements OnInit, OnDestroy {
  private mcqSvc = inject(McqService);
  private stackSvc = inject(StackService);
  private dialog = inject(MatDialog);
  private snack  = inject(SnackService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private confirm = inject(ConfirmService);

  // Server-driven page state.
  rows     = signal<McqResponse[]>([]);
  loading  = signal(true);
  page     = signal(0);
  pageSize = signal(10);
  totalElements = signal(0);
  totalPages    = computed(() => Math.max(1, Math.ceil(this.totalElements() / this.pageSize())));

  sort    = signal<SortState>({ key: 'updated', dir: 'desc' });
  filters = signal<Record<string, string | null>>({ status: null, difficulty: null, stack: null });
  search  = signal('');

  private stacks = signal<StackSummary[]>([]);

  readonly statusOptions = STATUS_FILTER_OPTIONS;
  readonly difficultyOptions = DIFFICULTY_FILTER_OPTIONS;
  readonly statusBadge = statusBadgeClass;
  readonly diffBadge = difficultyBadgeClass;
  readonly statusLabel = statusLabel;

  // Stack filter options come from the stacks list (not just the current page).
  stackOptions = computed<FilterOption[]>(() =>
    this.stacks().map(s => ({ value: s.stackName, label: s.stackName })));

  activeFilterCount = computed(() => Object.values(this.filters()).filter(v => v != null).length);

  // ── Per-user analytics from the dashboard stats endpoint (not the page) ──────
  stats = signal({ total: 0, drafts: 0, inReview: 0, needsChanges: 0, approved: 0, rejected: 0, approvalRate: 0 });

  // ── AI Generated review panel (gated accept/reject) ──────────────────────────
  tab       = signal<'mine' | 'ai'>('mine');
  aiRows    = signal<McqResponse[]>([]);
  aiLoading = signal(false);
  aiCount   = signal(0);

  private searchInput$ = new Subject<string>();
  private subs = new Subscription();

  ngOnInit(): void {
    this.stackSvc.getStacks().subscribe(r => this.stacks.set(r.data));
    this.loadStats();
    this.loadAi();

    // Debounced search → reset to first page, then reload.
    this.subs.add(
      this.searchInput$.pipe(debounceTime(350), distinctUntilChanged()).subscribe(value => {
        this.search.set(value);
        this.page.set(0);
        this.syncUrl();
        this.load();
      })
    );

    // Restore state from the URL (deep-linkable / copy-pasteable).
    const qp = this.route.snapshot.queryParamMap;
    this.filters.set({ status: qp.get('status'), difficulty: qp.get('difficulty'), stack: qp.get('stack') });
    const sortKey = qp.get('sort');
    if (sortKey) this.sort.set({ key: sortKey, dir: qp.get('dir') === 'asc' ? 'asc' : 'desc' });
    const search = qp.get('search');
    if (search) this.search.set(search);
    const page = Number(qp.get('page'));
    if (page > 0) this.page.set(page);
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
        search: this.search() || null,
        sort: isDefaultSort ? null : s.key,
        dir:  isDefaultSort ? null : s.dir,
        page: this.page() > 0 ? this.page() : null,
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
    const f = this.filters();
    const s = this.sort();
    this.mcqSvc.getMyQuestions({
      status: (f['status'] as McqStatus | null) ?? undefined,
      stackId: this.selectedStackId(),
      difficulty: (f['difficulty'] as Difficulty | null) ?? undefined,
      search: this.search() || undefined,
      sort: toBackendSortField(s.key),
      direction: s.dir,
      page: this.page(),
      size: this.pageSize(),
    }).subscribe({
      next: res => {
        this.rows.set(res.data.content);
        this.totalElements.set(res.data.totalElements);
        this.page.set(res.data.page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private loadStats(): void {
    this.mcqSvc.getDashboardStats().subscribe(r => {
      const d = r.data;
      const approved = d.approvedCount;
      const rejected = d.rejectedCount;
      const decided = approved + rejected;
      this.stats.set({
        total:        d.totalQuestions,
        drafts:       d.draftCount,
        inReview:     d.readyForReviewCount + d.underReviewCount,
        needsChanges: d.modificationRequestedCount,
        approved,
        rejected,
        approvalRate: decided > 0 ? Math.round((approved / decided) * 100) : 0,
      });
    });
  }

  setSort(s: SortState): void { this.sort.set(s); this.page.set(0); this.syncUrl(); this.load(); }
  setFilter(key: string, value: string | null): void {
    this.filters.update(f => ({ ...f, [key]: value }));
    this.page.set(0);
    this.syncUrl();
    this.load();
  }
  clearFilters(): void {
    this.filters.set({ status: null, difficulty: null, stack: null });
    this.search.set('');
    this.page.set(0);
    this.syncUrl();
    this.load();
  }
  onSearch(value: string): void { this.searchInput$.next(value); }

  /** Quick-filter the table from a stat card click. */
  filterByStatus(status: string | null): void {
    this.filters.update(f => ({ ...f, status }));
    this.page.set(0);
    this.syncUrl();
    this.load();
  }

  prevPage(): void { if (this.page() > 0) { this.page.update(p => p - 1); this.syncUrl(); this.load(); } }
  nextPage(): void { if (this.page() < this.totalPages() - 1) { this.page.update(p => p + 1); this.syncUrl(); this.load(); } }

  openCreate(): void {
    const ref = this.dialog.open(QuestionFormComponent, { data: {}, maxWidth: '780px', width: '100%' });
    ref.afterClosed().subscribe(result => { if (result) this.refresh(); });
  }

  openAiGenerate(): void {
    const ref = this.dialog.open(AiGenerateDialogComponent, { maxWidth: '600px', width: '100%' });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      // Generated questions land in the AI review panel for the creator to vet first.
      this.tab.set('ai');
      this.loadAi();
    });
  }

  // ── AI Generated review panel ────────────────────────────────────────────────
  setTab(tab: 'mine' | 'ai'): void {
    this.tab.set(tab);
    if (tab === 'ai') this.loadAi();
  }

  /** Load the creator's AI-pending questions (the review queue). */
  loadAi(): void {
    this.aiLoading.set(true);
    this.mcqSvc.getMyQuestions({ status: 'AI_PENDING', sort: 'createdAt', direction: 'desc', size: 100 }).subscribe({
      next: res => {
        this.aiRows.set(res.data.content);
        this.aiCount.set(res.data.totalElements);
        this.aiLoading.set(false);
      },
      error: () => this.aiLoading.set(false),
    });
  }

  /** Accept an AI question into drafts (AI_PENDING → DRAFT). */
  acceptAi(q: McqResponse): void {
    this.mcqSvc.acceptAiQuestion(q.id).subscribe({
      next: () => { this.snack.success('Accepted — moved to your drafts'); this.loadAi(); this.refresh(); },
      error: err => this.snack.error(err.error?.message ?? 'Failed to accept'),
    });
  }

  /** Reject (discard) an AI question. */
  rejectAi(q: McqResponse): void {
    this.confirm.ask({
      title: 'Discard this AI question?',
      message: 'This AI-generated question will be permanently removed. This cannot be undone.',
      confirmText: 'Discard', variant: 'danger', icon: 'delete',
    }).then(ok => {
      if (!ok) return;
      this.mcqSvc.deleteQuestion(q.id).subscribe({
        next: () => { this.snack.success('Discarded'); this.loadAi(); },
        error: err => this.snack.error(err.error?.message ?? 'Failed to discard'),
      });
    });
  }

  goBulkUpload(): void { this.router.navigate(['/bulk-upload']); }

  openView(q: McqResponse): void {
    window.open('/questions/' + q.id, '_blank');
  }

  openEdit(q: McqResponse): void {
    const ref = this.dialog.open(QuestionFormComponent, { data: { question: q }, maxWidth: '780px', width: '100%' });
    ref.afterClosed().subscribe(result => { if (result) this.refresh(); });
  }

  submitForReview(q: McqResponse): void {
    this.mcqSvc.submitForReview(q.id).subscribe({
      next: () => { this.snack.success('Submitted for review'); this.refresh(); },
      error: err => this.snack.error(err.error?.message ?? 'Failed to submit')
    });
  }

  delete(q: McqResponse): void {
    this.confirm.ask({
      title: 'Delete question?',
      message: 'This question will be permanently removed. This cannot be undone.',
      confirmText: 'Delete', variant: 'danger', icon: 'delete',
    }).then(ok => {
      if (!ok) return;
      this.mcqSvc.deleteQuestion(q.id).subscribe({
        next: () => { this.snack.success('Question deleted'); this.refresh(); },
        error: err => this.snack.error(err.error?.message ?? 'Delete failed')
      });
    });
  }

  /** Reload the current page and refresh the stat strip after a mutation. */
  private refresh(): void { this.load(); this.loadStats(); }

  truncate(text: string, max = 60): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }
}
