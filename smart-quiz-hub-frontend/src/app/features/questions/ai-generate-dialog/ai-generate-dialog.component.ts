import { Component, inject, OnInit, signal } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { AiService } from '../../../core/services/ai.service';
import { StackService } from '../../../core/services/stack.service';
import { SnackService } from '../../../core/services/snack.service';
import { StackSummary, TopicResponse } from '../../../core/models';

/**
 * "Generate with AI" dialog (Level 2). Available to both SMEs and Admins.
 * Generated questions are screened for duplicates server-side and land in
 * "My Questions" with a DRAFT status.
 */
@Component({
  selector: 'app-ai-generate-dialog',
  standalone: true,
  imports: [
    MatDialogModule, MatButtonModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatProgressSpinnerModule,
    MatIconModule, ReactiveFormsModule
  ],
  template: `
    <div mat-dialog-title class="px-6 pt-6 pb-0">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center">
          <span class="material-icons text-white text-[18px]">auto_awesome</span>
        </div>
        <div>
          <h2 class="text-xl font-bold text-slate-900">AI Question Generator</h2>
          <p class="text-slate-400 text-sm">Duplicates are screened automatically</p>
        </div>
      </div>
    </div>

    <mat-dialog-content class="px-6 pt-4 pb-2" style="min-width:520px">
      <form [formGroup]="form" class="flex flex-col gap-4">

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Stack</label>
            <select formControlName="stackId"
              (change)="onStack(+$any($event.target).value)"
              class="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-slate-50 focus:bg-white appearance-none">
              <option [value]="null">Select stack…</option>
              @for (s of stacks(); track s.id) {
                <option [value]="s.id">{{ s.stackName }}</option>
              }
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Topic</label>
            <select formControlName="topicId"
              class="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-slate-50 focus:bg-white appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
              [disabled]="topics().length === 0">
              <option [value]="null">{{ topics().length === 0 ? 'Select stack first' : 'Select topic…' }}</option>
              @for (t of topics(); track t.id) {
                <option [value]="t.id">{{ t.topicName }}</option>
              }
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Difficulty</label>
            <select formControlName="difficulty"
              class="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-slate-50 focus:bg-white appearance-none">
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Count (1–10)</label>
            <input type="number" formControlName="count" min="1" max="10"
              class="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-slate-50 focus:bg-white" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Topic Context / Hints</label>
          <textarea rows="3" formControlName="topicContext"
            placeholder="e.g. Focus on practical use-cases, circuit breaker patterns..."
            class="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none bg-slate-50 focus:bg-white"></textarea>
        </div>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions class="px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
      <button mat-dialog-close
              class="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all">
        Cancel
      </button>
      <button [disabled]="form.invalid || loading()" (click)="generate()"
              class="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 disabled:opacity-60 disabled:cursor-not-allowed transition-all">
        @if (loading()) {
          <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Generating…
        } @else {
          <span class="material-icons text-[17px]">auto_awesome</span>
          Generate
        }
      </button>
    </mat-dialog-actions>
  `
})
export class AiGenerateDialogComponent implements OnInit {
  private fb       = inject(FormBuilder);
  private aiSvc    = inject(AiService);
  private stackSvc = inject(StackService);
  private snack    = inject(SnackService);
  dialogRef        = inject(MatDialogRef<AiGenerateDialogComponent>);

  stacks  = signal<StackSummary[]>([]);
  topics  = signal<TopicResponse[]>([]);
  loading = signal(false);

  form = this.fb.group({
    stackId:      [null, Validators.required],
    topicId:      [null, Validators.required],
    difficulty:   ['MEDIUM', Validators.required],
    topicContext: ['', Validators.required],
    count:        [3, [Validators.required, Validators.min(1), Validators.max(10)]]
  });

  ngOnInit(): void {
    this.stackSvc.getStacks().subscribe(r => this.stacks.set(r.data));
  }

  onStack(id: number): void {
    this.form.patchValue({ topicId: null });
    this.topics.set([]);
    this.stackSvc.getTopics(id).subscribe(r => this.topics.set(r.data));
  }

  generate(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);

    this.aiSvc.generate(this.form.value as any).subscribe({
      next: res => {
        const n = res.data.length;
        if (n === 0) {
          this.snack.error('No unique questions could be generated — try a different topic or context');
        } else {
          this.snack.success(`Generated ${n} unique question(s) as DRAFT`);
        }
        this.loading.set(false);
        this.dialogRef.close(n > 0);
      },
      error: err => {
        this.snack.error(err.error?.message ?? 'AI generation failed');
        this.loading.set(false);
      }
    });
  }
}
