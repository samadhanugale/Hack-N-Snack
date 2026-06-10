import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { McqService } from '../../../core/services/mcq.service';
import { StackService } from '../../../core/services/stack.service';
import { SnackService } from '../../../core/services/snack.service';
import { AiService } from '../../../core/services/ai.service';
import {
  McqResponse, McqRequest, StackSummary, TopicResponse,
  DuplicateCheckRequest, DuplicateCheckResponse
} from '../../../core/models';

export interface QuestionFormData {
  question?: McqResponse;
}

@Component({
  selector: 'app-question-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatDividerModule
  ],
  templateUrl: './question-form.component.html',
  styleUrl: './question-form.component.scss'
})
export class QuestionFormComponent implements OnInit {
  private fb      = inject(FormBuilder);
  private mcqSvc  = inject(McqService);
  private stackSvc= inject(StackService);
  private snack   = inject(SnackService);
  private aiSvc   = inject(AiService);
  dialogRef       = inject(MatDialogRef<QuestionFormComponent>);
  data            = inject<QuestionFormData>(MAT_DIALOG_DATA);

  stacks  = signal<StackSummary[]>([]);
  topics  = signal<TopicResponse[]>([]);
  loading = signal(false);
  checking = signal(false);
  dupResult = signal<DuplicateCheckResponse | null>(null);

  isEdit  = !!this.data.question;
  canSubmitForReview = !this.isEdit ||
    this.data.question?.status === 'DRAFT' ||
    this.data.question?.status === 'REJECTED';

  form = this.fb.group({
    questionStem: [this.data.question?.questionStem ?? '', [Validators.required, Validators.minLength(20)]],
    optionA:      [this.data.question?.optionA ?? '', [Validators.required]],
    optionB:      [this.data.question?.optionB ?? '', [Validators.required]],
    optionC:      [this.data.question?.optionC ?? '', [Validators.required]],
    optionD:      [this.data.question?.optionD ?? '', [Validators.required]],
    correctOption:[this.data.question?.correctOption ?? '', [Validators.required]],
    difficulty:   [this.data.question?.difficulty ?? '', [Validators.required]],
    stackId:      [this.data.question?.stackId ?? null as number | null, [Validators.required]],
    topicId:      [this.data.question?.topicId ?? null as number | null, [Validators.required]]
  });

  ngOnInit(): void {
    this.stackSvc.getStacks().subscribe(res => {
      this.stacks.set(res.data);
      if (this.data.question?.stackId) {
        this.loadTopics(this.data.question.stackId);
      }
    });
  }

  onStackChange(stackId: number): void {
    this.form.patchValue({ topicId: null });
    this.topics.set([]);
    if (stackId) this.loadTopics(stackId);
  }

  private loadTopics(stackId: number): void {
    this.stackSvc.getTopics(stackId).subscribe(res => this.topics.set(res.data));
  }

  /** All fields needed to compare against the bank are present. */
  get canCheck(): boolean {
    const v = this.form.value;
    return !!(v.stackId && v.topicId && v.questionStem &&
      v.optionA && v.optionB && v.optionC && v.optionD);
  }

  private buildDupRequest(): DuplicateCheckRequest {
    const v = this.form.value;
    return {
      stackId: v.stackId as number,
      topicId: v.topicId as number,
      questionStem: v.questionStem ?? '',
      optionA: v.optionA ?? '',
      optionB: v.optionB ?? '',
      optionC: v.optionC ?? '',
      optionD: v.optionD ?? '',
      excludeId: this.isEdit ? this.data.question!.id : null
    };
  }

  /** Manual "Duplicate Check" button. */
  runDuplicateCheck(): void {
    if (this.checking()) return;
    if (!this.canCheck) {
      this.snack.error('Fill in stack, topic, question and all four options first');
      return;
    }
    this.checking.set(true);
    this.dupResult.set(null);

    this.aiSvc.duplicateCheck(this.buildDupRequest()).subscribe({
      next: res => {
        this.dupResult.set(res.data);
        this.checking.set(false);
        if (res.data.duplicate) {
          this.snack.error(`Possible duplicate — ${res.data.maxSimilarityPercent}% similar`);
        } else {
          this.snack.success(`No duplicates found (max ${res.data.maxSimilarityPercent}%)`);
        }
      },
      error: err => {
        this.checking.set(false);
        this.snack.error(err.error?.message ?? 'Duplicate check failed');
      }
    });
  }

  save(submitAfter = false): void {
    if (this.form.invalid || this.loading() || this.checking()) return;

    // Drafts/updates are always allowed; only "Send for Review" enforces the
    // similarity threshold (mirrors the server-side rule).
    if (!submitAfter) {
      this.persist(false);
      return;
    }

    this.loading.set(true);
    this.aiSvc.duplicateCheck(this.buildDupRequest()).subscribe({
      next: res => {
        this.dupResult.set(res.data);
        if (res.data.duplicate) {
          this.loading.set(false);
          this.snack.error(
            `Too similar (${res.data.maxSimilarityPercent}%, threshold ${res.data.thresholdPercent}%). ` +
            `Revise the question before sending for review.`);
          return;
        }
        this.persist(true);
      },
      // If the check itself errors, let the backend make the final call on submit.
      error: () => this.persist(true)
    });
  }

  private persist(submitAfter: boolean): void {
    this.loading.set(true);
    const req = this.form.value as McqRequest;
    const obs = this.isEdit
      ? this.mcqSvc.updateQuestion(this.data.question!.id, req)
      : this.mcqSvc.createQuestion(req);

    obs.subscribe({
      next: res => {
        if (submitAfter) {
          this.mcqSvc.submitForReview(res.data.id).subscribe({
            next: () => {
              this.snack.success('Question submitted for review');
              this.dialogRef.close(res.data);
            },
            error: err => {
              this.loading.set(false);
              this.applyDuplicateError(err);
              this.snack.error(err.error?.message ?? 'Saved but could not submit for review');
            }
          });
        } else {
          this.snack.success(this.isEdit ? 'Question updated' : 'Question saved as DRAFT');
          this.dialogRef.close(res.data);
        }
      },
      error: err => {
        this.snack.error(err.error?.message ?? 'Save failed');
        this.loading.set(false);
      }
    });
  }

  /** Render the similar-question detail when the server blocks a submit (409). */
  private applyDuplicateError(err: any): void {
    const data = err?.error?.data;
    if (err?.status === 409 && data && Array.isArray(data.similar)) {
      this.dupResult.set({
        duplicate: true,
        maxSimilarityPercent: data.maxSimilarityPercent,
        thresholdPercent: data.thresholdPercent,
        similar: data.similar
      });
    }
  }
}
