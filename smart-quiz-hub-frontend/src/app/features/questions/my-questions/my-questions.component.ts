import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatePipe, NgClass } from '@angular/common';
import { McqService } from '../../../core/services/mcq.service';
import { SnackService } from '../../../core/services/snack.service';
import { McqResponse } from '../../../core/models';
import { QuestionFormComponent } from '../question-form/question-form.component';
import { QuestionDetailDialogComponent } from '../question-detail/question-detail-dialog.component';
import { AiGenerateDialogComponent } from '../ai-generate-dialog/ai-generate-dialog.component';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { TableHeaderCellComponent } from '../../../shared/components/table-header-cell/table-header-cell.component';
import { ButtonDirective } from '../../../shared/components/button/button.directive';
import { CountUpDirective } from '../../../shared/directives/count-up.directive';
import { applyFilters, applySort, distinctOptions, SortState } from '../../../shared/utils/table-ops';
import { mcqColumnValue, STATUS_FILTER_OPTIONS, DIFFICULTY_FILTER_OPTIONS } from '../../../shared/utils/mcq-columns';
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
export class MyQuestionsComponent implements OnInit {
  private mcqSvc = inject(McqService);
  private dialog = inject(MatDialog);
  private snack  = inject(SnackService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  allRows  = signal<McqResponse[]>([]);
  loading  = signal(true);
  page     = signal(0);
  pageSize = signal(10);

  sort    = signal<SortState>({ key: 'updated', dir: 'desc' });
  filters = signal<Record<string, string | null>>({ status: null, difficulty: null, stack: null });

  readonly statusOptions = STATUS_FILTER_OPTIONS;
  readonly difficultyOptions = DIFFICULTY_FILTER_OPTIONS;
  readonly value = mcqColumnValue;
  readonly statusBadge = statusBadgeClass;
  readonly diffBadge = difficultyBadgeClass;
  readonly statusLabel = statusLabel;

  stackOptions = computed(() => distinctOptions(this.allRows(), mcqColumnValue, 'stack'));

  private filtered = computed(() => applyFilters(this.allRows(), this.filters(), mcqColumnValue));
  private sorted   = computed(() => applySort(this.filtered(), this.sort(), mcqColumnValue));

  totalElements = computed(() => this.filtered().length);
  totalPages    = computed(() => Math.max(1, Math.ceil(this.totalElements() / this.pageSize())));
  rows = computed(() => {
    const start = this.page() * this.pageSize();
    return this.sorted().slice(start, start + this.pageSize());
  });
  activeFilterCount = computed(() => Object.values(this.filters()).filter(v => v != null).length);

  // ── Per-user analytics (computed from the loaded set) ──────────────────────
  private countBy(status: string): number {
    return this.allRows().filter(q => q.status === status).length;
  }
  stats = computed(() => {
    const rows = this.allRows();
    const approved = this.countBy('APPROVED');
    const rejected = this.countBy('REJECTED');
    const decided = approved + rejected;
    return {
      total:        rows.length,
      drafts:       this.countBy('DRAFT'),
      inReview:     this.countBy('READY_FOR_REVIEW') + this.countBy('UNDER_REVIEW'),
      needsChanges: this.countBy('MODIFICATION_REQUESTED'),
      approved,
      rejected,
      approvalRate: decided > 0 ? Math.round((approved / decided) * 100) : 0,
    };
  });

  ngOnInit(): void {
    // Restore state from the URL (deep-linkable / copy-pasteable).
    const qp = this.route.snapshot.queryParamMap;
    this.filters.set({ status: qp.get('status'), difficulty: qp.get('difficulty'), stack: qp.get('stack') });
    const sortKey = qp.get('sort');
    if (sortKey) this.sort.set({ key: sortKey, dir: qp.get('dir') === 'asc' ? 'asc' : 'desc' });
    const page = Number(qp.get('page'));
    if (page > 0) this.page.set(page);
    this.load();
  }

  private syncUrl(): void {
    const f = this.filters();
    const s = this.sort();
    const isDefaultSort = s.key === 'updated' && s.dir === 'desc';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: f['status'], difficulty: f['difficulty'], stack: f['stack'],
        sort: isDefaultSort ? null : s.key,
        dir:  isDefaultSort ? null : s.dir,
        page: this.page() > 0 ? this.page() : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  load(): void {
    this.loading.set(true);
    // Load the full set once; sorting/filtering/paging happen client-side.
    this.mcqSvc.getMyQuestions(undefined, 0, 1000).subscribe({
      next: res => { this.allRows.set(res.data.content); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  setSort(s: SortState): void { this.sort.set(s); this.page.set(0); this.syncUrl(); }
  setFilter(key: string, value: string | null): void {
    this.filters.update(f => ({ ...f, [key]: value }));
    this.page.set(0);
    this.syncUrl();
  }
  clearFilters(): void {
    this.filters.set({ status: null, difficulty: null, stack: null });
    this.page.set(0);
    this.syncUrl();
  }
  /** Quick-filter the table from a stat card click. */
  filterByStatus(status: string | null): void {
    this.filters.update(f => ({ ...f, status }));
    this.page.set(0);
    this.syncUrl();
  }

  prevPage(): void { if (this.page() > 0) { this.page.update(p => p - 1); this.syncUrl(); } }
  nextPage(): void { if (this.page() < this.totalPages() - 1) { this.page.update(p => p + 1); this.syncUrl(); } }

  openCreate(): void {
    const ref = this.dialog.open(QuestionFormComponent, { data: {}, maxWidth: '780px', width: '100%' });
    ref.afterClosed().subscribe(result => { if (result) this.load(); });
  }

  openAiGenerate(): void {
    const ref = this.dialog.open(AiGenerateDialogComponent, { maxWidth: '600px', width: '100%' });
    ref.afterClosed().subscribe(result => { if (result) this.load(); });
  }

  goBulkUpload(): void { this.router.navigate(['/bulk-upload']); }

  openView(q: McqResponse): void {
    this.dialog.open(QuestionDetailDialogComponent, { data: { question: q }, maxWidth: '720px', width: '100%' });
  }

  openEdit(q: McqResponse): void {
    const ref = this.dialog.open(QuestionFormComponent, { data: { question: q }, maxWidth: '780px', width: '100%' });
    ref.afterClosed().subscribe(result => { if (result) this.load(); });
  }

  submitForReview(q: McqResponse): void {
    this.mcqSvc.submitForReview(q.id).subscribe({
      next: () => { this.snack.success('Submitted for review'); this.load(); },
      error: err => this.snack.error(err.error?.message ?? 'Failed to submit')
    });
  }

  delete(q: McqResponse): void {
    if (!confirm('Delete this question?')) return;
    this.mcqSvc.deleteQuestion(q.id).subscribe({
      next: () => { this.snack.success('Question deleted'); this.load(); },
      error: err => this.snack.error(err.error?.message ?? 'Delete failed')
    });
  }

  truncate(text: string, max = 60): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }
}
