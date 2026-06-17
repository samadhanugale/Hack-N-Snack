import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { DatePipe } from '@angular/common';
import { McqResponse } from '../../../core/models';
import { statusBadgeClass, difficultyBadgeClass, statusLabel } from '../../../shared/utils/badge';
import { AuditService, AuditLog } from '../../../core/services/audit.service';

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

      <!-- History (lazy-loaded audit trail) -->
      <div class="mt-6 pt-4 border-t border-slate-100">
        <button type="button" (click)="toggleHistory()"
                class="press flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700 uppercase tracking-widest transition-colors"
                [attr.aria-expanded]="historyOpen">
          <span class="material-icons text-[18px] transition-transform"
                [class.rotate-90]="historyOpen" aria-hidden="true">chevron_right</span>
          History
        </button>

        @if (historyOpen) {
          <div class="mt-4 animate-scale-in">
            @if (historyLoading) {
              <p class="text-xs text-slate-400 pl-1">Loading history…</p>
            } @else if (historyError) {
              <p class="text-xs text-rose-500 pl-1">{{ historyError }}</p>
            } @else if (history.length === 0) {
              <p class="text-xs text-slate-400 pl-1">No history recorded yet.</p>
            } @else {
              <ol class="relative ml-2 border-l border-slate-200">
                @for (entry of history; track entry.id) {
                  <li class="relative pl-6 pb-5 last:pb-0">
                    <span class="absolute -left-[7px] top-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ring-4 ring-white"
                          [class]="actionDotClass(entry.action)">
                      <span class="material-icons text-white text-[9px]" aria-hidden="true">{{ actionIcon(entry.action) }}</span>
                    </span>
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-xs font-bold text-slate-700">{{ actionLabel(entry.action) }}</span>
                      <span class="text-[11px] text-slate-400">· {{ relativeTime(entry.createdAt) }}</span>
                    </div>
                    @if (entry.performedByName) {
                      <p class="text-[11px] text-slate-500 mt-0.5">by {{ entry.performedByName }}</p>
                    }
                    @if (entry.details) {
                      <p class="text-xs text-slate-600 mt-1 leading-snug">{{ entry.details }}</p>
                    }
                  </li>
                }
              </ol>
            }
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
  private readonly auditService = inject(AuditService);
  data = inject<QuestionDetailData>(MAT_DIALOG_DATA);
  q = this.data.question;

  readonly diffBadge = difficultyBadgeClass;
  readonly statusBadge = statusBadgeClass;
  readonly statusLabel = statusLabel;

  // History (audit trail) — lazy-loaded the first time the section is opened.
  historyOpen = false;
  historyLoading = false;
  historyError: string | null = null;
  history: AuditLog[] = [];
  private historyLoaded = false;

  optionLabel(i: number): string {
    return String.fromCharCode(65 + i);
  }

  toggleHistory(): void {
    this.historyOpen = !this.historyOpen;
    if (this.historyOpen && !this.historyLoaded) {
      this.loadHistory();
    }
  }

  private loadHistory(): void {
    this.historyLoading = true;
    this.historyError = null;
    this.auditService.getForQuestion(this.q.id).subscribe({
      next: page => {
        this.history = page.content;
        this.historyLoaded = true;
        this.historyLoading = false;
      },
      error: () => {
        this.historyError = 'Could not load history.';
        this.historyLoading = false;
      },
    });
  }

  actionLabel(action: string): string {
    return action
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  actionIcon(action: string): string {
    switch (action) {
      case 'CREATED': return 'add';
      case 'UPDATED': return 'edit';
      case 'SUBMITTED': return 'send';
      case 'ASSIGNED': return 'person_add';
      case 'APPROVED': return 'check';
      case 'REJECTED': return 'close';
      case 'MODIFICATION_REQUESTED': return 'autorenew';
      case 'DELETED': return 'delete';
      default: return 'history';
    }
  }

  actionDotClass(action: string): string {
    switch (action) {
      case 'APPROVED': return 'bg-emerald-500';
      case 'REJECTED': return 'bg-rose-500';
      case 'MODIFICATION_REQUESTED': return 'bg-amber-500';
      case 'SUBMITTED': return 'bg-indigo-500';
      case 'ASSIGNED': return 'bg-cyan-500';
      case 'DELETED': return 'bg-slate-500';
      case 'CREATED': return 'bg-violet-500';
      default: return 'bg-slate-400';
    }
  }

  relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }
}
