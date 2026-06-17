import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { DatePipe } from '@angular/common';
import { McqResponse } from '../../../core/models';
import { statusBadgeClass, difficultyBadgeClass, statusLabel } from '../../../shared/utils/badge';

export interface QuestionDetailData {
  question: McqResponse;
}

/** Read-only view of a question — full stem, every option (correct ones highlighted),
 *  reviewer feedback and audit metadata. Works for any status (incl. approved/rejected). */
@Component({
  selector: 'app-question-detail-dialog',
  standalone: true,
  imports: [MatDialogModule, DatePipe],
  template: `
    <!-- Header -->
    <div class="flex items-start justify-between gap-4 px-7 pt-6 pb-4 border-b border-slate-100">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-lg shadow-slate-500/20 flex-shrink-0">
          <span class="material-icons text-white text-[20px]" aria-hidden="true">visibility</span>
        </div>
        <div class="min-w-0">
          <h2 class="text-lg font-bold text-slate-900 leading-tight">Question #{{ q.id }}</h2>
          <p class="text-xs text-slate-400 mt-0.5">Read-only view</p>
        </div>
      </div>
      <button mat-dialog-close aria-label="Close" class="press w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all flex-shrink-0">
        <span class="material-icons text-[20px]" aria-hidden="true">close</span>
      </button>
    </div>

    <mat-dialog-content class="max-w-full animate-scale-in">
      <!-- Meta chips -->
      <div class="flex items-center gap-2 flex-wrap mb-5 mt-1 stagger">
        <span [class]="diffBadge(q.difficulty)">{{ q.difficulty }}</span>
        <span class="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">{{ q.stackName }}</span>
        <span class="px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 text-xs font-semibold border border-cyan-100">{{ q.topicName }}</span>
        <span class="ml-auto" [class]="statusBadge(q.status)">{{ statusLabel(q.status) }}</span>
      </div>

      <!-- Question stem -->
      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Question</p>
      <p class="text-slate-800 text-sm leading-relaxed mb-6 font-medium whitespace-pre-line">{{ q.questionStem }}</p>

      <!-- Options -->
      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
        Options <span class="text-emerald-500 normal-case font-semibold">· correct answers highlighted</span>
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        @for (opt of q.options; track $index; let i = $index) {
          <div class="flex items-start gap-3 p-3.5 rounded-xl border"
               [class]="q.correctOptionIndices.includes(i) ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'">
            <span class="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-px"
                  [class]="q.correctOptionIndices.includes(i) ? 'bg-emerald-500 text-white' : 'bg-indigo-100 text-indigo-700'">
              {{ optionLabel(i) }}
            </span>
            <span class="text-sm text-slate-700 leading-snug flex-1">{{ opt }}</span>
            @if (q.correctOptionIndices.includes(i)) {
              <span class="material-icons text-emerald-500 text-[18px] flex-shrink-0" aria-label="Correct answer" role="img">check_circle</span>
            }
          </div>
        }
      </div>

      <!-- Reviewer feedback -->
      @if (q.reviewerComments) {
        <div class="flex gap-3 mb-6 rounded-xl px-4 py-3 border"
             [class]="q.status === 'REJECTED' ? 'bg-rose-50 border-rose-200' : 'bg-violet-50 border-violet-200'">
          <span class="material-icons text-[18px] mt-0.5 flex-shrink-0"
                aria-hidden="true"
                [class]="q.status === 'REJECTED' ? 'text-rose-400' : 'text-violet-400'">feedback</span>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest mb-1"
               [class]="q.status === 'REJECTED' ? 'text-rose-500' : 'text-violet-500'">Reviewer Feedback</p>
            <p class="text-sm leading-relaxed" [class]="q.status === 'REJECTED' ? 'text-rose-700' : 'text-violet-700'">{{ q.reviewerComments }}</p>
          </div>
        </div>
      }

      <!-- Metadata -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 pt-4 border-t border-slate-100 text-xs">
        <div>
          <p class="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Creator</p>
          <p class="text-slate-700 mt-0.5">{{ q.creatorName }}</p>
        </div>
        <div>
          <p class="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Reviewer</p>
          <p class="text-slate-700 mt-0.5">{{ q.reviewerName ?? '—' }}</p>
        </div>
        <div>
          <p class="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Created</p>
          <p class="text-slate-700 mt-0.5">{{ q.createdAt | date:'dd MMM yyyy, h:mm a' }}</p>
        </div>
        <div>
          <p class="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Last Updated</p>
          <p class="text-slate-700 mt-0.5">{{ q.updatedAt | date:'dd MMM yyyy, h:mm a' }}</p>
        </div>
        @if (q.aiSimilarityScore != null) {
          <div>
            <p class="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">AI Similarity</p>
            <p class="text-slate-700 mt-0.5">{{ (q.aiSimilarityScore * 100).toFixed(1) }}%</p>
          </div>
        }
      </div>
    </mat-dialog-content>

    <div class="flex justify-end px-7 py-4 border-t border-slate-100 bg-slate-50/60">
      <button mat-dialog-close
              class="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
        Close
      </button>
    </div>
  `,
})
export class QuestionDetailDialogComponent {
  data = inject<QuestionDetailData>(MAT_DIALOG_DATA);
  q = this.data.question;

  readonly diffBadge = difficultyBadgeClass;
  readonly statusBadge = statusBadgeClass;
  readonly statusLabel = statusLabel;

  optionLabel(i: number): string {
    return String.fromCharCode(65 + i);
  }
}
