import { Component, computed, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { McqService } from '../../../core/services/mcq.service';
import { AiService, AiReview } from '../../../core/services/ai.service';
import { ReviewService } from '../../../core/services/review.service';
import { AuditService, AuditLog } from '../../../core/services/audit.service';
import { CommentService, QuestionComment } from '../../../core/services/comment.service';
import { AuthService } from '../../../core/services/auth.service';
import { SnackService } from '../../../core/services/snack.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { McqResponse, McqStatus } from '../../../core/models';
import { statusBadgeClass, difficultyBadgeClass, statusLabel } from '../../../shared/utils/badge';
import { ButtonDirective } from '../../../shared/components/button/button.directive';
import { AiService, AiReview } from '../../../core/services/ai.service';

@Component({
  selector: 'app-question-view',
  standalone: true,
  imports: [DatePipe, FormsModule, ButtonDirective, MatDialogModule],
  template: `
    <div class="max-w-3xl mx-auto animate-fade-up">

      <!-- Nav bar -->
      <div class="flex items-center gap-3 mb-5">
        <button (click)="back()" aria-label="Go back"
                class="press w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
          <span class="material-icons text-[20px]" aria-hidden="true">arrow_back</span>
        </button>
        <span class="text-sm text-slate-400 dark:text-slate-500 font-medium">
          Questions / <span class="text-slate-700 dark:text-slate-200 font-semibold">{{ q ? 'Question #' + q.id : '…' }}</span>
        </span>
        <div class="ml-auto flex items-center gap-2">
          <button (click)="copyLink()"
                  class="press flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-all">
            <span class="material-icons text-[16px]" aria-hidden="true">{{ copied ? 'check' : 'link' }}</span>
            {{ copied ? 'Copied!' : 'Copy link' }}
          </button>
        </div>
      </div>

      <!-- Loading skeleton -->
      @if (loading) {
        <div class="card p-6">
          <div class="skeleton h-7 w-40 mb-4 rounded-lg"></div>
          <div class="skeleton h-4 w-full mb-2 rounded"></div>
          <div class="skeleton h-4 w-3/4 mb-6 rounded"></div>
          <div class="grid grid-cols-2 gap-3">
            @for (n of [1,2,3,4]; track n) { <div class="skeleton h-16 w-full rounded-xl"></div> }
          </div>
        </div>
      }

      <!-- Error -->
      @else if (error) {
        <div class="card p-12 flex flex-col items-center gap-4 text-center animate-fade-up">
          <div class="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
            <span class="material-icons text-rose-400 text-3xl" aria-hidden="true">error_outline</span>
          </div>
          <div>
            <p class="text-slate-800 dark:text-slate-100 font-bold text-lg">Cannot load question</p>
            <p class="text-slate-400 dark:text-slate-500 text-sm mt-1">{{ error }}</p>
          </div>
          <button (click)="back()" class="mt-2 text-indigo-600 dark:text-indigo-400 text-sm font-semibold hover:underline">Go back</button>
        </div>
      }

      <!-- Question detail -->
      @else if (q) {
        <div class="card overflow-hidden">

          <!-- Card header -->
          <div class="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-slate-100 dark:border-white/[0.08]">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0">
                <span class="material-icons text-white text-[20px]" aria-hidden="true">quiz</span>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h1 class="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">Question #{{ q.id }}</h1>
                  <span class="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 select-all cursor-text">ID: {{ q.id }}</span>
                </div>
                <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{{ q.stackName }} · {{ q.topicName }}</p>
              </div>
            </div>
            <span [class]="statusBadge(q.status)" class="flex-shrink-0 mt-1">{{ statusLabel(q.status) }}</span>
          </div>

          <div class="px-6 py-5 space-y-6">

            <!-- Meta chips -->
            <div class="flex items-center gap-2 flex-wrap">
              <span [class]="diffBadge(q.difficulty)">{{ q.difficulty }}</span>
              <span class="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-100 dark:border-indigo-500/20">{{ q.stackName }}</span>
              <span class="px-2.5 py-1 rounded-full bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 text-xs font-semibold border border-cyan-100 dark:border-cyan-500/20">{{ q.topicName }}</span>
            </div>

            <!-- Question stem -->
            <div>
              <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Question</p>
              <p class="text-slate-800 dark:text-slate-200 text-sm leading-relaxed font-medium whitespace-pre-line">{{ q.questionStem }}</p>
            </div>

            <!-- Options -->
            <div>
              <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                Options <span class="text-emerald-500 normal-case font-semibold">· correct answers highlighted</span>
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                @for (opt of q.options; track $index; let i = $index) {
                  <div class="flex items-start gap-3 p-3.5 rounded-xl border"
                       [class]="q.correctOptionIndices.includes(i)
                         ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-600/40'
                         : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'">
                    <span class="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-px"
                          [class]="q.correctOptionIndices.includes(i)
                            ? 'bg-emerald-500 text-white'
                            : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'">
                      {{ optionLabel(i) }}
                    </span>
                    <span class="text-sm text-slate-700 dark:text-slate-300 leading-snug flex-1">{{ opt }}</span>
                    @if (q.correctOptionIndices.includes(i)) {
                      <span class="material-icons text-emerald-500 text-[18px] flex-shrink-0" aria-label="Correct answer">check_circle</span>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Reviewer feedback -->
            @if (q.reviewerComments) {
              <div class="flex gap-3 rounded-xl px-4 py-3 border"
                   [class]="q.status === 'REJECTED'
                     ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-600/40'
                     : 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-600/40'">
                <span class="material-icons text-[18px] mt-0.5 flex-shrink-0" aria-hidden="true"
                      [class]="q.status === 'REJECTED' ? 'text-rose-400' : 'text-violet-400'">feedback</span>
                <div>
                  <p class="text-[10px] font-bold uppercase tracking-widest mb-1"
                     [class]="q.status === 'REJECTED' ? 'text-rose-500' : 'text-violet-500'">Reviewer Feedback</p>
                  <p class="text-sm leading-relaxed"
                     [class]="q.status === 'REJECTED' ? 'text-rose-700 dark:text-rose-300' : 'text-violet-700 dark:text-violet-300'">{{ q.reviewerComments }}</p>
                </div>
              </div>
            }

            <!-- Metadata grid -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 pt-4 border-t border-slate-100 dark:border-white/[0.08] text-xs">
              <div>
                <p class="text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Creator</p>
                <p class="text-slate-700 dark:text-slate-300 mt-0.5">{{ q.creatorName }}</p>
              </div>
              <div>
                <p class="text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Reviewer</p>
                <p class="text-slate-700 dark:text-slate-300 mt-0.5">{{ q.reviewerName ?? '—' }}</p>
              </div>
              <div>
                <p class="text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Created</p>
                <p class="text-slate-700 dark:text-slate-300 mt-0.5">{{ q.createdAt | date:'dd MMM yyyy' }}</p>
              </div>
              <div>
                <p class="text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Updated</p>
                <p class="text-slate-700 dark:text-slate-300 mt-0.5">{{ q.updatedAt | date:'dd MMM yyyy' }}</p>
              </div>
              @if (q.aiSimilarityScore != null) {
                <div>
                  <p class="text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">AI Similarity</p>
                  <p class="text-slate-700 dark:text-slate-300 mt-0.5">{{ (q.aiSimilarityScore * 100).toFixed(1) }}%</p>
                </div>
              }
            </div>

            <!-- AI Review Assistant -->
            <div class="pt-4 border-t border-slate-100 dark:border-white/[0.08]">
              <div class="flex items-center justify-between gap-2 mb-3">
                <div class="flex items-center gap-2">
                  <span class="material-icons text-[18px] text-violet-500" aria-hidden="true">auto_awesome</span>
                  <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">AI Review Assistant</p>
                </div>
                @if (!aiReview && !aiLoading) {
                  <button type="button" appBtn="accent" size="sm" (click)="analyze()">
                    <span class="material-icons text-[15px]" aria-hidden="true">auto_awesome</span> Analyze with AI
                  </button>
                } @else if (aiReview && !aiLoading) {
                  <button type="button" (click)="analyze()" class="press text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">Re-analyze</button>
                }
              </div>

              @if (aiLoading) {
                <div class="flex items-center gap-2 text-sm text-slate-400 py-3">
                  <span class="material-icons animate-spin text-[18px]" aria-hidden="true">autorenew</span> Analyzing question quality…
                </div>
              } @else if (aiError) {
                <p class="text-sm text-rose-500 py-2">{{ aiError }}</p>
              } @else if (aiReview; as r) {
                <div class="animate-scale-in space-y-4">
                  <div class="flex items-center gap-4 flex-wrap">
                    <div class="relative w-14 h-14 flex-shrink-0">
                      <svg viewBox="0 0 36 36" class="w-14 h-14 -rotate-90">
                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e5e7eb" stroke-width="3.5"></circle>
                        <circle cx="18" cy="18" r="15.9155" fill="none" [attr.stroke]="scoreColor(r.qualityScore)" stroke-width="3.5"
                                stroke-linecap="round" [attr.stroke-dasharray]="r.qualityScore + ', 100'"></circle>
                      </svg>
                      <span class="absolute inset-0 flex items-center justify-center text-sm font-extrabold" [style.color]="scoreColor(r.qualityScore)">{{ r.qualityScore }}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quality score · suggested</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">{{ r.suggestedDifficulty }}</span>
                        @if (!r.aiPowered) {
                          <span class="text-[10px] text-slate-400 italic">heuristic (AI unavailable)</span>
                        }
                      </div>
                      <p class="text-sm text-slate-700 dark:text-slate-200 mt-1">{{ r.summary }}</p>
                    </div>
                  </div>

                  @if (r.issues.length) {
                    <div class="space-y-1.5">
                      @for (iss of r.issues; track $index) {
                        <div class="flex items-start gap-2 text-xs">
                          <span class="material-icons text-[15px] flex-shrink-0" [style.color]="issueColor(iss.severity)" aria-hidden="true">{{ issueIcon(iss.severity) }}</span>
                          <span class="text-slate-600 dark:text-slate-300 leading-snug">{{ iss.message }}</span>
                        </div>
                      }
                    </div>
                  }

                  @if (r.answerExplanation) {
                    <div class="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-600/30 px-3 py-2.5">
                      <p class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Why the answer is correct</p>
                      <p class="text-sm text-emerald-800 dark:text-emerald-200 leading-snug">{{ r.answerExplanation }}</p>
                    </div>
                  }

                  @if (r.suggestions.length) {
                    <div>
                      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Suggestions</p>
                      <ul class="list-disc pl-5 space-y-0.5">
                        @for (s of r.suggestions; track $index) { <li class="text-sm text-slate-600 dark:text-slate-300">{{ s }}</li> }
                      </ul>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- History (lazy-loaded) -->
            <div class="pt-4 border-t border-slate-100 dark:border-white/[0.08]">
              <button type="button" (click)="toggleHistory()"
                      class="press flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 uppercase tracking-widest transition-colors"
                      [attr.aria-expanded]="historyOpen">
                <span class="material-icons text-[18px] transition-transform" [class.rotate-90]="historyOpen" aria-hidden="true">chevron_right</span>
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
                    <ol class="relative ml-2 border-l border-slate-200 dark:border-white/[0.1]">
                      @for (entry of history; track entry.id) {
                        <li class="relative pl-6 pb-5 last:pb-0">
                          <span class="absolute -left-[7px] top-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-[#12121e]"
                                [class]="actionDotClass(entry.action)">
                            <span class="material-icons text-white text-[9px]" aria-hidden="true">{{ actionIcon(entry.action) }}</span>
                          </span>
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-xs font-bold text-slate-700 dark:text-slate-300">{{ actionLabel(entry.action) }}</span>
                            <span class="text-[11px] text-slate-400 dark:text-slate-500">· {{ relativeTime(entry.createdAt) }}</span>
                          </div>
                          @if (entry.performedByName) {
                            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">by {{ entry.performedByName }}</p>
                          }
                          @if (entry.details) {
                            <p class="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-snug">{{ entry.details }}</p>
                          }
                        </li>
                      }
                    </ol>
                  }
                </div>
              }
            </div>

            <!-- Discussion -->
            <div class="pt-4 border-t border-slate-100 dark:border-white/[0.08]">
              <div class="flex items-center gap-2 mb-3">
                <span class="material-icons text-[18px] text-indigo-400" aria-hidden="true">forum</span>
                <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Discussion</p>
                @if (comments.length) {
                  <span class="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold">{{ comments.length }}</span>
                }
              </div>
              @if (commentsLoading) {
                <p class="text-xs text-slate-400 pl-1">Loading discussion…</p>
              } @else if (commentsError) {
                <p class="text-xs text-rose-500 pl-1">{{ commentsError }}</p>
              } @else {
                <div class="max-h-72 overflow-y-auto pr-1 space-y-3 mb-4">
                  @if (comments.length === 0) {
                    <p class="text-xs text-slate-400 dark:text-slate-500 pl-1">No comments yet — start the conversation below.</p>
                  }
                  @for (c of comments; track c.id) {
                    <div class="flex flex-col animate-scale-in"
                         [class.items-end]="isMine(c)" [class.items-start]="!isMine(c)">
                      <div class="max-w-[85%] rounded-2xl px-3.5 py-2.5 border shadow-sm"
                           [class]="isMine(c)
                             ? 'bg-gradient-to-br from-indigo-500 to-violet-600 border-transparent text-white rounded-br-sm'
                             : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-sm'">
                        <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span class="text-[11px] font-bold" [class]="isMine(c) ? 'text-white' : 'text-slate-700 dark:text-slate-200'">
                            {{ isMine(c) ? 'You' : c.authorName }}
                          </span>
                          @if (c.authorRole) {
                            <span class="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                                  [class]="isMine(c) ? 'bg-white/20 text-white' : roleChipClass(c.authorRole)">
                              {{ c.authorRole }}
                            </span>
                          }
                          <span class="text-[10px]" [class]="isMine(c) ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'">
                            · {{ relativeTime(c.createdAt) }}
                          </span>
                        </div>
                        <p class="text-sm leading-snug whitespace-pre-line break-words">{{ c.body }}</p>
                      </div>
                    </div>
                  }
                </div>
                <div class="flex items-end gap-2">
                  <textarea [(ngModel)]="draft" rows="2" maxlength="2000"
                            (keydown.enter)="onComposerEnter($event)"
                            [disabled]="sending"
                            placeholder="Write a message…"
                            class="field flex-1 px-3 py-2 text-sm resize-none"></textarea>
                  <button type="button" appBtn="primary" size="icon"
                          [disabled]="!draft.trim() || sending"
                          (click)="send()" aria-label="Send comment">
                    <span class="material-icons text-[18px]" aria-hidden="true">{{ sending ? 'hourglass_empty' : 'send' }}</span>
                  </button>
                </div>
              }
            </div>

          </div>

          <!-- ── Action footer (only shown when the user has relevant actions) ── -->
          @if (showActions()) {
            <div class="px-6 py-4 border-t border-slate-100 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] space-y-3">

              <!-- Inline review decision panel -->
              @if (pendingDecision) {
                <div class="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#12121e] p-4 space-y-3 animate-scale-in">
                  <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    {{ pendingDecision === 'REJECTED' ? 'Rejection reason' : 'Requested changes' }}
                    <span class="text-rose-400 ml-1">*</span>
                  </p>
                  <textarea [(ngModel)]="reviewComment" rows="3" maxlength="2000"
                            placeholder="Explain what needs to change…"
                            class="field w-full px-3 py-2 text-sm resize-none"></textarea>
                  <div class="flex items-center gap-2 justify-end">
                    <button type="button" (click)="pendingDecision = null; reviewComment = ''"
                            class="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-all">
                      Cancel
                    </button>
                    <button type="button" (click)="submitDecision()"
                            [disabled]="!reviewComment.trim() || actionLoading"
                            [class]="pendingDecision === 'REJECTED' ? 'px-5 py-2 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all' : 'px-5 py-2 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all'">
                      {{ actionLoading ? 'Submitting…' : (pendingDecision === 'REJECTED' ? 'Confirm Reject' : 'Confirm Request') }}
                    </button>
                  </div>
                </div>
              }

              <!-- Action buttons row -->
              <div class="flex items-center gap-2 flex-wrap">

                <!-- Creator actions -->
                @if (canEdit()) {
                  <button type="button" (click)="openEdit()" [disabled]="actionLoading" appBtn="secondary" size="sm">
                    <span class="material-icons text-[15px]">edit</span> Edit
                  </button>
                }
                @if (canSubmitForReview()) {
                  <button type="button" (click)="submitForReview()" [disabled]="actionLoading" appBtn="warning" size="sm">
                    <span class="material-icons text-[15px]">send</span>
                    {{ actionLoading ? 'Submitting…' : 'Submit for Review' }}
                  </button>
                }
                @if (canDelete()) {
                  <button type="button" (click)="deleteQuestion()" [disabled]="actionLoading" appBtn="danger" size="sm">
                    <span class="material-icons text-[15px]">delete</span> Delete
                  </button>
                }

                <!-- Reviewer / Admin actions -->
                @if (canApprove()) {
                  <button type="button" (click)="quickDecision('APPROVED')" [disabled]="actionLoading" appBtn="success" size="sm">
                    <span class="material-icons text-[15px]">check_circle</span>
                    {{ actionLoading && pendingDecision === null ? 'Approving…' : 'Approve' }}
                  </button>
                }
                @if (canRejectOrModify()) {
                  <button type="button"
                          (click)="pendingDecision = 'MODIFICATION_REQUESTED'"
                          [disabled]="actionLoading" appBtn="accent" size="sm">
                    <span class="material-icons text-[15px]">autorenew</span> Request Changes
                  </button>
                  <button type="button"
                          (click)="pendingDecision = 'REJECTED'"
                          [disabled]="actionLoading" appBtn="danger" size="sm">
                    <span class="material-icons text-[15px]">cancel</span> Reject
                  </button>
                }

              </div>
            </div>
          }

        </div>
      }
    </div>
  `,
})
export class QuestionViewComponent implements OnInit {
  private readonly route          = inject(ActivatedRoute);
  private readonly router         = inject(Router);
  private readonly mcqSvc         = inject(McqService);
  private readonly reviewSvc      = inject(ReviewService);
  private readonly auditService   = inject(AuditService);
  private readonly commentService = inject(CommentService);
  private readonly auth           = inject(AuthService);
  private readonly snack          = inject(SnackService);
  private readonly confirm        = inject(ConfirmService);
  private readonly dialog         = inject(MatDialog);
  private readonly aiSvc          = inject(AiService);

  q: McqResponse | null = null;
  loading = true;
  error: string | null = null;
  copied = false;
  actionLoading = false;

  // Review decision state
  pendingDecision: 'REJECTED' | 'MODIFICATION_REQUESTED' | null = null;
  reviewComment = '';

  readonly diffBadge   = difficultyBadgeClass;
  readonly statusBadge = statusBadgeClass;
  readonly statusLabel = statusLabel;

  // ── Permission signals ──────────────────────────────────────────────────────

  readonly isOwner = computed(() =>
    this.q != null && this.auth.currentUserId() === this.q.creatorId
  );
  readonly isAdmin = this.auth.isAdmin;
  readonly isAssignedReviewer = computed(() =>
    this.q != null && this.auth.currentUserId() === this.q.reviewerId
  );

  /** Any action section should be visible. */
  readonly showActions = computed(() =>
    this.canEdit() || this.canSubmitForReview() || this.canDelete() ||
    this.canApprove() || this.canRejectOrModify()
  );

  readonly canEdit = computed(() => {
    if (!this.q) return false;
    const editableStatuses: McqStatus[] = ['DRAFT', 'READY_FOR_REVIEW', 'MODIFICATION_REQUESTED'];
    return (this.isOwner() && editableStatuses.includes(this.q.status)) || this.isAdmin();
  });

  readonly canSubmitForReview = computed(() => {
    if (!this.q) return false;
    const submittableStatuses: McqStatus[] = ['DRAFT', 'MODIFICATION_REQUESTED'];
    return this.isOwner() && submittableStatuses.includes(this.q.status);
  });

  readonly canDelete = computed(() => {
    if (!this.q) return false;
    const deletableStatuses: McqStatus[] = ['DRAFT', 'READY_FOR_REVIEW'];
    return (this.isOwner() && deletableStatuses.includes(this.q.status)) || this.isAdmin();
  });

  readonly canApprove = computed(() => {
    if (!this.q) return false;
    const reviewableStatuses: McqStatus[] = ['READY_FOR_REVIEW', 'UNDER_REVIEW'];
    if (this.isAdmin() && reviewableStatuses.includes(this.q.status)) return true;
    return this.isAssignedReviewer() && this.q.status === 'UNDER_REVIEW';
  });

  readonly canRejectOrModify = computed(() => this.canApprove());

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  historyOpen = false;
  historyLoading = false;
  historyError: string | null = null;
  history: AuditLog[] = [];
  private historyLoaded = false;

  comments: QuestionComment[] = [];
  commentsLoading = false;
  commentsError: string | null = null;
  draft = '';
  sending = false;

  // AI Review Assistant
  aiReview: AiReview | null = null;
  aiLoading = false;
  aiError: string | null = null;

  ngOnInit(): void {
    this.loadQuestion();
  }

  private loadQuestion(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loading = true;
    this.error = null;
    this.mcqSvc.getQuestion(id).subscribe({
      next: res => {
        this.q = res.data;
        this.loading = false;
        this.loadComments();
      },
      error: err => {
        this.error = err?.error?.message ?? 'Question not found or you do not have access.';
        this.loading = false;
      },
    });
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async openEdit(): Promise<void> {
    if (!this.q) return;
    const { QuestionFormComponent } = await import('../question-form/question-form.component');
    const ref = this.dialog.open(QuestionFormComponent, {
      data: { question: this.q },
      maxWidth: '780px',
      width: '100%',
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.loadQuestion();
    });
  }

  submitForReview(): void {
    if (!this.q || this.actionLoading) return;
    this.actionLoading = true;
    this.mcqSvc.submitForReview(this.q.id).subscribe({
      next: res => {
        this.q = res.data;
        this.snack.success('Submitted for review');
        this.actionLoading = false;
      },
      error: err => {
        this.snack.error(err?.error?.message ?? 'Failed to submit');
        this.actionLoading = false;
      },
    });
  }

  async deleteQuestion(): Promise<void> {
    if (!this.q) return;
    const ok = await this.confirm.ask({
      title: 'Delete Question',
      message: `Are you sure you want to delete Question #${this.q.id}? This cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    this.actionLoading = true;
    this.mcqSvc.deleteQuestion(this.q.id).subscribe({
      next: () => {
        this.snack.success('Question deleted');
        this.router.navigate(['/questions']);
      },
      error: err => {
        this.snack.error(err?.error?.message ?? 'Failed to delete');
        this.actionLoading = false;
      },
    });
  }

  quickDecision(decision: 'APPROVED'): void {
    if (!this.q || this.actionLoading) return;
    this.actionLoading = true;
    this.reviewSvc.submitReview(this.q.id, { decision }).subscribe({
      next: res => {
        this.q = res.data;
        this.snack.success('Question approved');
        this.actionLoading = false;
      },
      error: err => {
        this.snack.error(err?.error?.message ?? 'Failed to approve');
        this.actionLoading = false;
      },
    });
  }

  submitDecision(): void {
    if (!this.q || !this.pendingDecision || !this.reviewComment.trim() || this.actionLoading) return;
    this.actionLoading = true;
    this.reviewSvc.submitReview(this.q.id, {
      decision: this.pendingDecision,
      comments: this.reviewComment.trim(),
    }).subscribe({
      next: res => {
        this.q = res.data;
        this.snack.success(
          this.pendingDecision === 'REJECTED' ? 'Question rejected' : 'Modification requested'
        );
        this.pendingDecision = null;
        this.reviewComment = '';
        this.actionLoading = false;
      },
      error: err => {
        this.snack.error(err?.error?.message ?? 'Failed to submit decision');
        this.actionLoading = false;
      },
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  optionLabel(i: number): string { return String.fromCharCode(65 + i); }

  back(): void { window.history.back(); }

  copyLink(): void {
    navigator.clipboard.writeText(window.location.href).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }

  isMine(c: QuestionComment): boolean {
    return c.authorName === this.auth.currentUser()?.fullName;
  }

  roleChipClass(role: string): string {
    return role === 'ADMIN'
      ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
      : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300';
  }

  private loadComments(): void {
    if (!this.q) return;
    this.commentsLoading = true;
    this.commentService.getComments(this.q.id).subscribe({
      next: list => { this.comments = list; this.commentsLoading = false; },
      error: () => { this.commentsError = 'Could not load the discussion.'; this.commentsLoading = false; },
    });
  }

  onComposerEnter(event: Event): void {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) { ke.preventDefault(); this.send(); }
  }

  send(): void {
    const body = this.draft.trim();
    if (!body || this.sending || !this.q) return;
    this.sending = true;
    this.commentService.addComment(this.q.id, body).subscribe({
      next: comment => { this.comments = [...this.comments, comment]; this.draft = ''; this.sending = false; },
      error: () => { this.sending = false; },
    });
  }

  // ── AI Review Assistant ──────────────────────────────────────────────────────
  analyze(): void {
    if (!this.q || this.aiLoading) return;
    this.aiLoading = true;
    this.aiError = null;
    this.aiSvc.reviewQuestion(this.q.id).subscribe({
      next: res => { this.aiReview = res.data; this.aiLoading = false; },
      error: () => { this.aiError = 'AI analysis failed — please try again.'; this.aiLoading = false; },
    });
  }
  scoreColor(s: number): string { return s >= 75 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444'; }
  issueColor(sev: string): string {
    return sev === 'CRITICAL' ? '#ef4444' : sev === 'WARNING' ? '#f59e0b' : '#94a3b8';
  }
  issueIcon(sev: string): string {
    return sev === 'CRITICAL' ? 'error' : sev === 'WARNING' ? 'warning' : 'info';
  }

  toggleHistory(): void {
    this.historyOpen = !this.historyOpen;
    if (this.historyOpen && !this.historyLoaded) this.loadHistory();
  }

  private loadHistory(): void {
    if (!this.q) return;
    this.historyLoading = true;
    this.auditService.getForQuestion(this.q.id).subscribe({
      next: page => { this.history = page.content; this.historyLoaded = true; this.historyLoading = false; },
      error: () => { this.historyError = 'Could not load history.'; this.historyLoading = false; },
    });
  }

  actionLabel(action: string): string {
    return action.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  actionIcon(action: string): string {
    switch (action) {
      case 'CREATED':               return 'add';
      case 'UPDATED':               return 'edit';
      case 'SUBMITTED':             return 'send';
      case 'ASSIGNED':              return 'person_add';
      case 'APPROVED':              return 'check';
      case 'REJECTED':              return 'close';
      case 'MODIFICATION_REQUESTED': return 'autorenew';
      case 'DELETED':               return 'delete';
      default:                      return 'history';
    }
  }

  actionDotClass(action: string): string {
    switch (action) {
      case 'APPROVED':               return 'bg-emerald-500';
      case 'REJECTED':               return 'bg-rose-500';
      case 'MODIFICATION_REQUESTED': return 'bg-amber-500';
      case 'SUBMITTED':              return 'bg-indigo-500';
      case 'ASSIGNED':               return 'bg-cyan-500';
      case 'DELETED':                return 'bg-slate-500';
      case 'CREATED':                return 'bg-violet-500';
      default:                       return 'bg-slate-400';
    }
  }

  relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (secs < 60)    return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60)    return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)   return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30)    return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12)  return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }
}
