import { Component, inject, OnInit, signal } from '@angular/core';
import {
  FormBuilder, Validators, ReactiveFormsModule,
  FormArray, FormGroup, AbstractControl, ValidationErrors
} from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NgClass } from '@angular/common';
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

function atLeastOneCorrect(arr: AbstractControl): ValidationErrors | null {
  const fa = arr as FormArray;
  return fa.controls.some(c => c.get('isCorrect')?.value === true)
    ? null : { noCorrectOption: true };
}

@Component({
  selector: 'app-question-form',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatProgressSpinnerModule, NgClass],
  templateUrl: './question-form.component.html',
})
export class QuestionFormComponent implements OnInit {
  private fb       = inject(FormBuilder);
  private mcqSvc   = inject(McqService);
  private stackSvc = inject(StackService);
  private snack    = inject(SnackService);
  private aiSvc    = inject(AiService);
  dialogRef        = inject(MatDialogRef<QuestionFormComponent>);
  data             = inject<QuestionFormData>(MAT_DIALOG_DATA);

  stacks    = signal<StackSummary[]>([]);
  topics    = signal<TopicResponse[]>([]);
  loading   = signal(false);
  checking  = signal(false);
  dupResult = signal<DuplicateCheckResponse | null>(null);

  isEdit = !!this.data.question;
  // A rejected question is terminal — permanently locked from edits (Story 1.3).
  isLocked = this.isEdit && this.data.question?.status === 'REJECTED';
  canSubmitForReview = !this.isLocked && (!this.isEdit ||
    this.data.question?.status === 'DRAFT' ||
    this.data.question?.status === 'MODIFICATION_REQUESTED');

  readonly difficulties = [
    { value: 'EASY',   label: 'Easy',   classes: 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-600/50 dark:text-emerald-400 dark:bg-emerald-900/20', activeClasses: 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30' },
    { value: 'MEDIUM', label: 'Medium', classes: 'border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-600/50 dark:text-amber-400 dark:bg-amber-900/20',             activeClasses: 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/30' },
    { value: 'HARD',   label: 'Hard',   classes: 'border-rose-300 text-rose-700 bg-rose-50 dark:border-rose-600/50 dark:text-rose-400 dark:bg-rose-900/20',                   activeClasses: 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/30' },
  ];

  form = this.fb.group({
    stackId:      [this.data.question?.stackId   ?? null as number | null, [Validators.required]],
    topicId:      [this.data.question?.topicId   ?? null as number | null, [Validators.required]],
    difficulty:   [this.data.question?.difficulty ?? '',                   [Validators.required]],
    questionStem: [this.data.question?.questionStem ?? '', [Validators.required, Validators.minLength(20)]],
    options: this.fb.array(this.buildInitialOptionRows(), [atLeastOneCorrect])
  });

  get optionsArray(): FormArray { return this.form.get('options') as FormArray; }

  get step1Complete(): boolean {
    const v = this.form.value;
    return !!(v.stackId && v.topicId && v.difficulty);
  }

  /** True when every existing option row has non-blank text — show "Add option" button. */
  get allOptionsFilled(): boolean {
    return this.optionsArray.controls.every(c => c.get('text')?.value?.trim());
  }

  get canCheck(): boolean {
    const filledOpts = this.optionsArray.controls.filter(c => c.get('text')?.value?.trim());
    const v = this.form.value;
    return !!(v.stackId && v.topicId && v.questionStem && filledOpts.length >= 4);
  }

  private buildInitialOptionRows(): FormGroup[] {
    const q = this.data.question;
    if (q?.options?.length) {
      return q.options.map((text, idx) =>
        this.fb.group({
          text:      [text, [Validators.required]],
          isCorrect: [q.correctOptionIndices?.includes(idx) ?? false]
        })
      );
    }
    return Array.from({ length: 4 }, () =>
      this.fb.group({ text: ['', [Validators.required]], isCorrect: [false] })
    );
  }

  ngOnInit(): void {
    this.stackSvc.getStacks().subscribe(res => {
      this.stacks.set(res.data);
      if (this.data.question?.stackId) this.loadTopics(this.data.question.stackId);
    });
    // Terminal rejected questions are read-only: disable every control (Story 1.3).
    if (this.isLocked) this.form.disable();
  }

  onStackChange(stackId: number): void {
    this.form.patchValue({ topicId: null });
    this.topics.set([]);
    if (stackId) this.loadTopics(stackId);
  }

  private loadTopics(stackId: number): void {
    this.stackSvc.getTopics(stackId).subscribe(res => this.topics.set(res.data));
  }

  setDifficulty(value: string): void {
    this.form.patchValue({ difficulty: value });
    this.form.get('difficulty')!.markAsTouched();
  }

  /** Click anywhere on the option card (not the input/delete) to toggle correct. */
  toggleCorrect(index: number): void {
    const ctrl = this.optionsArray.at(index);
    ctrl.patchValue({ isCorrect: !ctrl.get('isCorrect')!.value });
  }

  addOption(): void {
    this.optionsArray.push(
      this.fb.group({ text: ['', [Validators.required]], isCorrect: [false] })
    );
  }

  removeOption(index: number): void {
    if (this.optionsArray.length <= 4) {
      this.snack.error('A minimum of 4 options is required');
      return;
    }
    this.optionsArray.removeAt(index);
  }

  optionLabel(i: number): string { return String.fromCharCode(65 + i); }

  isCorrect(i: number): boolean {
    return !!this.optionsArray.at(i).get('isCorrect')?.value;
  }

  private buildDupRequest(): DuplicateCheckRequest {
    const v = this.form.value;
    return {
      stackId:      v.stackId as number,
      topicId:      v.topicId as number,
      questionStem: v.questionStem ?? '',
      options:      this.optionsArray.controls.map(c => c.get('text')?.value ?? ''),
      excludeId:    this.isEdit ? this.data.question!.id : null
    };
  }

  runDuplicateCheck(): void {
    if (this.checking() || !this.canCheck) return;
    this.checking.set(true);
    this.dupResult.set(null);
    this.aiSvc.duplicateCheck(this.buildDupRequest()).subscribe({
      next: res => {
        this.dupResult.set(res.data);
        this.checking.set(false);
        res.data.duplicate
          ? this.snack.error(`Possible duplicate — ${res.data.maxSimilarityPercent}% similar`)
          : this.snack.success(`No duplicates found (max ${res.data.maxSimilarityPercent}%)`);
      },
      error: err => {
        this.checking.set(false);
        this.snack.error(err.error?.message ?? 'Duplicate check failed');
      }
    });
  }

  save(submitAfter = false): void {
    if (this.form.invalid || this.loading() || this.checking()) return;
    if (!submitAfter) { this.persist(false); return; }

    this.loading.set(true);
    this.aiSvc.duplicateCheck(this.buildDupRequest()).subscribe({
      next: res => {
        this.dupResult.set(res.data);
        if (res.data.duplicate) {
          this.loading.set(false);
          this.snack.error(`Too similar (${res.data.maxSimilarityPercent}%). Revise before sending for review.`);
          return;
        }
        this.persist(true);
      },
      error: () => this.persist(true)
    });
  }

  private buildRequest(): McqRequest {
    const v = this.form.value;
    return {
      questionStem:        v.questionStem as string,
      options:             this.optionsArray.controls.map(c => c.get('text')?.value as string),
      correctOptionIndices: this.optionsArray.controls
                             .map((c, i) => c.get('isCorrect')?.value ? i : -1)
                             .filter(i => i >= 0),
      difficulty:  v.difficulty as any,
      stackId:     v.stackId as number,
      topicId:     v.topicId as number
    };
  }

  private persist(submitAfter: boolean): void {
    this.loading.set(true);
    const req = this.buildRequest();
    const obs = this.isEdit
      ? this.mcqSvc.updateQuestion(this.data.question!.id, req)
      : this.mcqSvc.createQuestion(req);

    obs.subscribe({
      next: res => {
        if (submitAfter) {
          this.mcqSvc.submitForReview(res.data.id).subscribe({
            next: () => { this.snack.success('Question submitted for review'); this.dialogRef.close(res.data); },
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
      error: err => { this.snack.error(err.error?.message ?? 'Save failed'); this.loading.set(false); }
    });
  }

  private applyDuplicateError(err: any): void {
    const data = err?.error?.data;
    if (err?.status === 409 && data && Array.isArray(data.similar)) {
      this.dupResult.set({ duplicate: true, maxSimilarityPercent: data.maxSimilarityPercent,
        thresholdPercent: data.thresholdPercent, similar: data.similar });
    }
  }
}
