import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ReviewService } from '../../../core/services/review.service';
import { SnackService } from '../../../core/services/snack.service';
import { McqResponse } from '../../../core/models';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { ColumnFilterComponent } from '../../../shared/components/column-filter/column-filter.component';
import { ButtonDirective } from '../../../shared/components/button/button.directive';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { applyFilters, applySort, distinctOptions, SortState } from '../../../shared/utils/table-ops';
import { mcqColumnValue, DIFFICULTY_FILTER_OPTIONS } from '../../../shared/utils/mcq-columns';
import { statusBadgeClass, difficultyBadgeClass } from '../../../shared/utils/badge';

type ReviewTab = 'pending' | 'reviewed';

@Component({
  selector: 'app-pending-reviews',
  standalone: true,
  imports: [
    MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule,
    FormsModule, DatePipe, RelativeTimePipe, ColumnFilterComponent, ButtonDirective,
    PageHeaderComponent
  ],
  templateUrl: './pending-reviews.component.html',
})
export class PendingReviewsComponent implements OnInit {
  private reviewSvc = inject(ReviewService);
  private snack     = inject(SnackService);
  private dialog    = inject(MatDialog);
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private confirm   = inject(ConfirmService);

  tab      = signal<ReviewTab>('pending');
  allRows  = signal<McqResponse[]>([]);
  loading  = signal(true);
  page     = signal(0);
  pageSize = signal(8);

  sort    = signal<SortState>({ key: 'updated', dir: 'desc' });
  filters = signal<Record<string, string | null>>({ stack: null, difficulty: null });

  reviewComments: Record<number, string> = {};

  readonly difficultyOptions = DIFFICULTY_FILTER_OPTIONS;
  readonly statusBadge = statusBadgeClass;
  readonly diffBadge = difficultyBadgeClass;
  readonly sortFields = [
    { key: 'updated', label: 'Updated' },
    { key: 'difficulty', label: 'Difficulty' },
    { key: 'stack', label: 'Stack' },
  ];

  stackOptions = computed(() => distinctOptions(this.allRows(), mcqColumnValue, 'stack'));
  sortLabel = computed(() => this.sortFields.find(f => f.key === this.sort().key)?.label ?? 'Updated');

  private filtered = computed(() => applyFilters(this.allRows(), this.filters(), mcqColumnValue));
  private sorted   = computed(() => applySort(this.filtered(), this.sort(), mcqColumnValue));
  totalElements = computed(() => this.filtered().length);
  totalPages    = computed(() => Math.max(1, Math.ceil(this.totalElements() / this.pageSize())));
  questions = computed(() => {
    const start = this.page() * this.pageSize();
    return this.sorted().slice(start, start + this.pageSize());
  });
  activeFilterCount = computed(() => Object.values(this.filters()).filter(v => v != null).length);

  /** Master–detail: the row whose detail is shown on the right. Falls back to the
   *  first item of the current page if the selection is no longer in the list. */
  selected = signal<McqResponse | null>(null);
  current = computed(() => {
    const sel = this.selected();
    const list = this.questions();
    if (sel && list.some(q => q.id === sel.id)) return sel;
    return list[0] ?? null;
  });
  select(q: McqResponse): void { this.selected.set(q); }

  /** Hours since the reviewer was assigned (review SLA clock), or null if unknown. */
  hoursSinceAssigned(q: McqResponse): number | null {
    if (!q.assignedAt) return null;
    return (Date.now() - new Date(q.assignedAt).getTime()) / 3_600_000;
  }
  /** Overdue once a pending review has sat past the 24h reminder SLA. */
  isOverdue(q: McqResponse): boolean {
    if (this.tab() !== 'pending') return false;
    const h = this.hoursSinceAssigned(q);
    return h != null && h >= 24;
  }

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('tab') === 'reviewed') this.tab.set('reviewed');
    const sortKey = qp.get('sort');
    if (sortKey) this.sort.set({ key: sortKey, dir: qp.get('dir') === 'asc' ? 'asc' : 'desc' });
    this.filters.update(f => ({ ...f, stack: qp.get('stack'), difficulty: qp.get('difficulty') }));
    const page = Number(qp.get('page'));
    if (page > 0) this.page.set(page);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const obs = this.tab() === 'reviewed'
      ? this.reviewSvc.getReviewedByMe(0, 1000)
      : this.reviewSvc.getPendingReviews(0, 1000);
    obs.subscribe({
      next: res => { this.allRows.set(res.data.content); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  setTab(t: ReviewTab): void {
    if (this.tab() === t) return;
    this.tab.set(t);
    this.page.set(0);
    this.syncUrl();
    this.load();
  }

  setSortKey(key: string): void { this.sort.update(s => ({ key, dir: s.dir })); this.page.set(0); this.syncUrl(); }
  toggleDir(): void { this.sort.update(s => ({ key: s.key, dir: s.dir === 'asc' ? 'desc' : 'asc' })); this.syncUrl(); }
  setFilter(key: string, value: string | null): void {
    this.filters.update(f => ({ ...f, [key]: value }));
    this.page.set(0);
    this.syncUrl();
  }
  clearFilters(): void { this.filters.set({ stack: null, difficulty: null }); this.page.set(0); this.syncUrl(); }

  prevPage(): void { if (this.page() > 0) { this.page.update(p => p - 1); this.syncUrl(); } }
  nextPage(): void { if (this.page() < this.totalPages() - 1) { this.page.update(p => p + 1); this.syncUrl(); } }

  openView(q: McqResponse): void {
    window.open('/questions/' + q.id, '_blank');
  }

  private syncUrl(): void {
    const f = this.filters();
    const s = this.sort();
    const isDefaultSort = s.key === 'updated' && s.dir === 'desc';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab:  this.tab() === 'reviewed' ? 'reviewed' : null,
        sort: isDefaultSort ? null : s.key,
        dir:  isDefaultSort ? null : s.dir,
        stack: f['stack'],
        difficulty: f['difficulty'],
        page: this.page() > 0 ? this.page() : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  optionLabel(index: number): string {
    return String.fromCharCode(65 + index);
  }

  approve(q: McqResponse): void {
    this.reviewSvc.submitReview(q.id, { decision: 'APPROVED' }).subscribe({
      next: () => { this.snack.success('Question approved'); this.load(); },
      error: err => this.snack.error(err.error?.message ?? 'Failed')
    });
  }

  reject(q: McqResponse): void {
    const comments = this.reviewComments[q.id];
    if (!comments?.trim()) {
      this.snack.error('Please provide feedback comments before rejecting');
      return;
    }
    this.confirm.ask({
      title: 'Reject this question?',
      message: 'Rejecting is permanent — the question will be locked from all future edits.',
      confirmText: 'Reject', variant: 'danger', icon: 'cancel',
    }).then(ok => {
      if (!ok) return;
      this.reviewSvc.submitReview(q.id, { decision: 'REJECTED', comments }).subscribe({
        next: () => { this.snack.success('Question rejected with feedback'); this.load(); },
        error: err => this.snack.error(err.error?.message ?? 'Failed')
      });
    });
  }

  requestModification(q: McqResponse): void {
    const comments = this.reviewComments[q.id];
    if (!comments?.trim()) {
      this.snack.error('Please describe the changes the creator should make');
      return;
    }
    this.reviewSvc.submitReview(q.id, { decision: 'MODIFICATION_REQUESTED', comments }).subscribe({
      next: () => { this.snack.success('Modifications requested — sent back to creator'); this.load(); },
      error: err => this.snack.error(err.error?.message ?? 'Failed')
    });
  }
}
