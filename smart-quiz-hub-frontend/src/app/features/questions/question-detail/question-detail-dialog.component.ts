import { Component, inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { McqResponse } from '../../../core/models';
import { statusBadgeClass, difficultyBadgeClass, statusLabel } from '../../../shared/utils/badge';
import { AuditService, AuditLog } from '../../../core/services/audit.service';
import { CommentService, QuestionComment } from '../../../core/services/comment.service';
import { AuthService } from '../../../core/services/auth.service';
import { ButtonDirective } from '../../../shared/components/button/button.directive';

export interface QuestionDetailData {
  question: McqResponse;
}

/** Read-only view of a question — full stem, every option (correct ones highlighted),
 *  reviewer feedback and audit metadata. Works for any status (incl. approved/rejected). */
@Component({
  selector: 'app-question-detail-dialog',
  standalone: true,
  imports: [MatDialogModule, DatePipe, FormsModule, ButtonDirective],
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

      <!-- Discussion (review thread between creator & reviewer/admins) -->
      <div class="mt-6 pt-4 border-t border-slate-100">
        <div class="flex items-center gap-2 mb-3">
          <span class="material-icons text-[18px] text-indigo-400" aria-hidden="true">forum</span>
          <p class="text-xs font-bold text-slate-500 uppercase tracking-widest">Discussion</p>
          @if (comments.length) {
            <span class="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">{{ comments.length }}</span>
          }
        </div>

        @if (commentsLoading) {
          <p class="text-xs text-slate-400 pl-1">Loading discussion…</p>
        } @else if (commentsError) {
          <p class="text-xs text-rose-500 pl-1">{{ commentsError }}</p>
        } @else {
          <div class="max-h-72 overflow-y-auto pr-1 space-y-3 mb-4">
            @if (comments.length === 0) {
              <p class="text-xs text-slate-400 pl-1">No comments yet — start the conversation below.</p>
            }
            @for (c of comments; track c.id) {
              <div class="flex flex-col animate-scale-in"
                   [class.items-end]="isMine(c)" [class.items-start]="!isMine(c)">
                <div class="max-w-[85%] rounded-2xl px-3.5 py-2.5 border shadow-sm"
                     [class]="isMine(c)
                       ? 'bg-gradient-to-br from-indigo-500 to-violet-600 border-transparent text-white rounded-br-sm'
                       : 'bg-slate-50 border-slate-200 text-slate-700 rounded-bl-sm'">
                  <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span class="text-[11px] font-bold" [class]="isMine(c) ? 'text-white' : 'text-slate-700'">
                      {{ isMine(c) ? 'You' : c.authorName }}
                    </span>
                    @if (c.authorRole) {
                      <span class="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                            [class]="isMine(c) ? 'bg-white/20 text-white' : roleChipClass(c.authorRole)">
                        {{ c.authorRole }}
                      </span>
                    }
                    <span class="text-[10px]" [class]="isMine(c) ? 'text-indigo-100' : 'text-slate-400'">
                      · {{ relativeTime(c.createdAt) }}
                    </span>
                  </div>
                  <p class="text-sm leading-snug whitespace-pre-line break-words">{{ c.body }}</p>
                </div>
              </div>
            }
          </div>

          <!-- Composer -->
          <div class="flex items-end gap-2">
            <textarea [(ngModel)]="draft" rows="2" maxlength="2000"
                      (keydown.enter)="onComposerEnter($event)"
                      [disabled]="sending"
                      placeholder="Write a message…"
                      class="field flex-1 px-3 py-2 !bg-slate-50 focus:!bg-white text-slate-800 text-sm resize-none"></textarea>
            <button type="button" appBtn="primary" size="icon"
                    [disabled]="!draft.trim() || sending"
                    (click)="send()" aria-label="Send comment">
              <span class="material-icons text-[18px]" aria-hidden="true">{{ sending ? 'hourglass_empty' : 'send' }}</span>
            </button>
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
export class QuestionDetailDialogComponent implements OnInit {
  private readonly auditService = inject(AuditService);
  private readonly commentService = inject(CommentService);
  private readonly auth = inject(AuthService);
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

  // Discussion thread — lazy-loaded once on dialog open.
  comments: QuestionComment[] = [];
  commentsLoading = false;
  commentsError: string | null = null;
  draft = '';
  sending = false;
  private readonly currentUserId = this.auth.currentUserId();

  ngOnInit(): void {
    this.loadComments();
  }

  optionLabel(i: number): string {
    return String.fromCharCode(65 + i);
  }

  /** A comment is "mine" when its author is the signed-in user. */
  isMine(c: QuestionComment): boolean {
    return this.currentUserId != null && c.authorName === this.auth.currentUser()?.fullName;
  }

  roleChipClass(role: string): string {
    return role === 'ADMIN'
      ? 'bg-violet-100 text-violet-700'
      : 'bg-indigo-100 text-indigo-700';
  }

  private loadComments(): void {
    this.commentsLoading = true;
    this.commentsError = null;
    this.commentService.getComments(this.q.id).subscribe({
      next: list => {
        this.comments = list;
        this.commentsLoading = false;
      },
      error: () => {
        this.commentsError = 'Could not load the discussion.';
        this.commentsLoading = false;
      },
    });
  }

  /** Submit on Enter (Shift+Enter keeps inserting newlines). */
  onComposerEnter(event: Event): void {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.send();
    }
  }

  send(): void {
    const body = this.draft.trim();
    if (!body || this.sending) return;
    this.sending = true;
    this.commentService.addComment(this.q.id, body).subscribe({
      next: comment => {
        this.comments = [...this.comments, comment];
        this.draft = '';
        this.sending = false;
      },
      error: () => {
        this.sending = false;
      },
    });
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
