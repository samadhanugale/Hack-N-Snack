import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatePipe, NgClass } from '@angular/common';
import { McqService } from '../../../core/services/mcq.service';
import { ReviewService } from '../../../core/services/review.service';
import { AdminService } from '../../../core/services/admin.service';
import { StackService } from '../../../core/services/stack.service';
import { SnackService } from '../../../core/services/snack.service';
import { McqResponse, McqStatus, StackSummary } from '../../../core/models';
import { AssignReviewerDialogComponent } from './assign-reviewer-dialog.component';
import { AiGenerateDialogComponent } from '../../questions/ai-generate-dialog/ai-generate-dialog.component';
import { QuestionFormComponent } from '../../questions/question-form/question-form.component';

@Component({
  selector: 'app-question-bank',
  standalone: true,
  imports: [
    MatButtonModule, MatIconModule, MatDialogModule, MatTooltipModule,
    DatePipe, NgClass
  ],
  templateUrl: './question-bank.component.html',
  styleUrl: './question-bank.component.scss'
})
export class QuestionBankComponent implements OnInit {
  private mcqSvc    = inject(McqService);
  private reviewSvc = inject(ReviewService);
  private adminSvc  = inject(AdminService);
  private stackSvc  = inject(StackService);
  private dialog    = inject(MatDialog);
  private snack     = inject(SnackService);

  questions     = signal<McqResponse[]>([]);
  stacks        = signal<StackSummary[]>([]);
  loading       = signal(true);
  totalElements = signal(0);
  page          = signal(0);
  pageSize      = signal(10);
  statusFilter  = signal<McqStatus | undefined>(undefined);
  stackFilter   = signal<number | undefined>(undefined);

  selectedIds = signal<Set<number>>(new Set());
  selectionCount = computed(() => this.selectedIds().size);

  get selectableQuestions(): McqResponse[] {
    return this.questions().filter(q =>
      q.status === 'READY_FOR_REVIEW' || q.status === 'UNDER_REVIEW'
    );
  }

  get allSelectableSelected(): boolean {
    const sel = this.selectedIds();
    const selectable = this.selectableQuestions;
    return selectable.length > 0 && selectable.every(q => sel.has(q.id));
  }

  statusOptions: Array<{ value: McqStatus | '', label: string }> = [
    { value: '', label: 'All Statuses' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'READY_FOR_REVIEW', label: 'Ready for Review' },
    { value: 'UNDER_REVIEW', label: 'Under Review' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' }
  ];

  ngOnInit(): void {
    this.stackSvc.getStacks().subscribe(r => this.stacks.set(r.data));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.selectedIds.set(new Set());
    this.mcqSvc.getAllQuestions({
      status: this.statusFilter(),
      stackId: this.stackFilter(),
      page: this.page(),
      size: this.pageSize()
    }).subscribe({
      next: res => {
        this.questions.set(res.data.content);
        this.totalElements.set(res.data.totalElements);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  toggleSelect(id: number): void {
    this.selectedIds.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  toggleSelectAll(): void {
    if (this.allSelectableSelected) {
      this.selectedIds.set(new Set());
    } else {
      this.selectedIds.set(new Set(this.selectableQuestions.map(q => q.id)));
    }
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  /** Single-question assign or reassign */
  openAssignReviewer(q: McqResponse): void {
    this.adminSvc.getSmesByStack(q.stackId).subscribe(res => {
      const ref = this.dialog.open(AssignReviewerDialogComponent, {
        data: { question: q, smes: res.data },
        maxWidth: '500px', width: '100%'
      });
      ref.afterClosed().subscribe(reviewerId => {
        if (reviewerId) {
          this.reviewSvc.assignReviewer(q.id, { reviewerId }).subscribe({
            next: () => {
              this.snack.success(
                q.status === 'UNDER_REVIEW' ? 'Reviewer reassigned' : 'Reviewer assigned'
              );
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
        data: { bulkCount: ids.length, smes: res.data },
        maxWidth: '500px', width: '100%'
      });
      ref.afterClosed().subscribe(reviewerId => {
        if (reviewerId) {
          this.reviewSvc.bulkAssignReviewer({ questionIds: ids, reviewerId }).subscribe({
            next: r => {
              const d = r.data;
              this.snack.success(
                d.skipped > 0
                  ? `Assigned ${d.assigned}, skipped ${d.skipped}`
                  : `${d.assigned} question${d.assigned !== 1 ? 's' : ''} assigned`
              );
              this.load();
            },
            error: err => this.snack.error(err.error?.message ?? 'Bulk assign failed')
          });
        }
      });
    });
  }

  openEdit(q: McqResponse): void {
    const ref = this.dialog.open(QuestionFormComponent, {
      data: { question: q }, maxWidth: '720px', width: '100%'
    });
    ref.afterClosed().subscribe(result => { if (result) this.load(); });
  }

  delete(q: McqResponse): void {
    if (!confirm(`Delete this question?\n\n"${q.questionStem.slice(0, 80)}…"`)) return;
    this.mcqSvc.deleteQuestion(q.id).subscribe({
      next: () => { this.snack.success('Question deleted'); this.load(); },
      error: err => this.snack.error(err.error?.message ?? 'Delete failed')
    });
  }

  openAiGenerate(): void {
    const ref = this.dialog.open(AiGenerateDialogComponent, {
      maxWidth: '600px', width: '100%'
    });
    ref.afterClosed().subscribe(result => { if (result) this.load(); });
  }

  truncate(text: string, max = 55): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  statusLabel(status: McqStatus): string {
    return status.replaceAll('_', ' ');
  }
}
