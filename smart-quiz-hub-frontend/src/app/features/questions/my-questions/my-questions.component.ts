import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatePipe, NgClass } from '@angular/common';
import { McqService } from '../../../core/services/mcq.service';
import { SnackService } from '../../../core/services/snack.service';
import { McqResponse, McqStatus } from '../../../core/models';
import {
  QuestionFormComponent
} from '../question-form/question-form.component';
import { AiGenerateDialogComponent } from '../ai-generate-dialog/ai-generate-dialog.component';

@Component({
  selector: 'app-my-questions',
  standalone: true,
  imports: [
    MatTableModule, MatPaginatorModule, MatButtonModule, MatIconModule, MatMenuModule,
    MatSelectModule, MatFormFieldModule, MatDialogModule,
    MatProgressSpinnerModule, MatChipsModule, MatTooltipModule,
    DatePipe, NgClass
  ],
  templateUrl: './my-questions.component.html',
  styleUrl: './my-questions.component.scss'
})
export class MyQuestionsComponent implements OnInit {
  private mcqSvc = inject(McqService);
  private dialog = inject(MatDialog);
  private snack  = inject(SnackService);
  private router = inject(Router);

  questions     = signal<McqResponse[]>([]);
  loading       = signal(true);
  totalElements = signal(0);
  page          = signal(0);
  pageSize      = signal(10);
  statusFilter  = signal<McqStatus | undefined>(undefined);

  displayedColumns = ['stem', 'stack', 'difficulty', 'status', 'updatedAt', 'actions'];

  statusOptions: Array<{ value: McqStatus | '', label: string }> = [
    { value: '', label: 'All' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'READY_FOR_REVIEW', label: 'Ready for Review' },
    { value: 'UNDER_REVIEW', label: 'Under Review' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' }
  ];

  ngOnInit(): void {
    this.loadQuestions();
  }

  loadQuestions(): void {
    this.loading.set(true);
    this.mcqSvc.getMyQuestions(this.statusFilter(), this.page(), this.pageSize())
      .subscribe({
        next: res => {
          this.questions.set(res.data.content);
          this.totalElements.set(res.data.totalElements);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
  }

  onPage(e: PageEvent): void {
    this.page.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
    this.loadQuestions();
  }

  onStatusFilter(status: string): void {
    this.statusFilter.set(status as McqStatus || undefined);
    this.page.set(0);
    this.loadQuestions();
  }

  openCreate(): void {
    const ref = this.dialog.open(QuestionFormComponent, {
      data: {}, maxWidth: '720px', width: '100%'
    });
    ref.afterClosed().subscribe(result => { if (result) this.loadQuestions(); });
  }

  openAiGenerate(): void {
    const ref = this.dialog.open(AiGenerateDialogComponent, {
      maxWidth: '600px', width: '100%'
    });
    ref.afterClosed().subscribe(result => { if (result) this.loadQuestions(); });
  }

  goBulkUpload(): void {
    this.router.navigate(['/bulk-upload']);
  }

  openEdit(q: McqResponse): void {
    const ref = this.dialog.open(QuestionFormComponent, {
      data: { question: q }, maxWidth: '720px', width: '100%'
    });
    ref.afterClosed().subscribe(result => { if (result) this.loadQuestions(); });
  }

  submitForReview(q: McqResponse): void {
    this.mcqSvc.submitForReview(q.id).subscribe({
      next: () => { this.snack.success('Submitted for review'); this.loadQuestions(); },
      error: err => this.snack.error(err.error?.message ?? 'Failed to submit')
    });
  }

  delete(q: McqResponse): void {
    if (!confirm('Delete this question?')) return;
    this.mcqSvc.deleteQuestion(q.id).subscribe({
      next: () => { this.snack.success('Question deleted'); this.loadQuestions(); },
      error: err => this.snack.error(err.error?.message ?? 'Delete failed')
    });
  }

  truncate(text: string, max = 60): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }
}
