import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfileService } from '../../core/services/profile.service';
import { MyAnalytics } from '../../core/models';
import { CountUpDirective } from '../../shared/directives/count-up.directive';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

interface DonutSegment { label: string; value: number; pct: number; color: string; dash: string; offset: number; }

@Component({
  selector: 'app-my-analytics',
  standalone: true,
  imports: [CommonModule, CountUpDirective, PageHeaderComponent],
  template: `
  <div class="animate-fade-up">
    <app-page-header
      icon="insights"
      title="My Analytics"
      subtitle="Your authoring stats and your review activity — scoped to you." />

    @if (loading()) {
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 stagger">
        @for (n of [1,2,3,4]; track n) { <div class="skeleton h-24 w-full"></div> }
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 stagger">
        @for (n of [1,2]; track n) { <div class="skeleton h-72 w-full"></div> }
      </div>
    } @else if (data(); as d) {

      <!-- ── KPI cards ─────────────────────────────────────────── -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7 stagger">
        <div class="card card-i px-4 py-4">
          <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Authored</p>
          <p class="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1"><span [appCountUp]="d.authoredTotal">0</span></p>
        </div>
        <div class="card card-i px-4 py-4">
          <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Approved</p>
          <p class="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1"><span [appCountUp]="d.approvedCount">0</span></p>
        </div>
        <div class="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl px-4 py-4 shadow-lg shadow-indigo-500/25">
          <p class="text-[11px] font-bold text-white/70 uppercase tracking-wider">Approval Rate</p>
          <p class="text-3xl font-extrabold text-white mt-1"><span [appCountUp]="approvalRate()">0</span>%</p>
        </div>
        <div class="card card-i px-4 py-4">
          <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reviews Pending</p>
          <p class="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-1"><span [appCountUp]="d.reviewPending">0</span></p>
        </div>
      </div>

      <!-- ── Authoring charts ──────────────────────────────────── -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <section class="card p-6">
          <h3 class="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">My questions by status</h3>
          <ng-container *ngTemplateOutlet="donutTpl; context: { segs: donut(d.authoredByStatus, 'status'), center: d.authoredTotal }"></ng-container>
        </section>
        <section class="card p-6">
          <h3 class="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">My questions by difficulty</h3>
          <ng-container *ngTemplateOutlet="donutTpl; context: { segs: donut(d.authoredByDifficulty, 'diff'), center: d.authoredTotal }"></ng-container>
        </section>
      </div>

      <!-- ── Weekly authored trend ─────────────────────────────── -->
      <section class="card p-6 mb-5">
        <h3 class="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Weekly authoring trend</h3>
        <p class="text-xs text-slate-400 mb-5">Questions you created over the last 8 weeks ({{ trendTotal() }} total)</p>
        @if (trendTotal() > 0) {
          <div class="flex items-end justify-between gap-2 h-44">
            @for (b of trendBars(); track $index) {
              <div class="flex-1 flex flex-col items-center gap-2 min-w-0">
                <div class="w-full flex items-end justify-center" style="height: 140px;">
                  <div class="w-full max-w-[42px] rounded-t-lg bg-gradient-to-t from-indigo-500 to-violet-500 transition-all duration-700"
                       [style.height.%]="b.pct" [title]="b.count + ' question(s)'"></div>
                </div>
                <span class="text-[10px] text-slate-400 whitespace-nowrap">{{ b.label }}</span>
              </div>
            }
          </div>
        } @else {
          <div class="flex flex-col items-center justify-center py-10 text-slate-400">
            <span class="material-icons text-4xl mb-2">bar_chart</span>
            <span class="text-sm">No questions authored yet</span>
          </div>
        }
      </section>

      <!-- ── My review decisions ───────────────────────────────── -->
      <section class="card p-6">
        <h3 class="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">My review decisions</h3>
        <p class="text-xs text-slate-400 mb-5">Outcomes of questions you reviewed, plus what's on your plate now</p>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-inset ring-emerald-100 dark:ring-emerald-800/40 px-4 py-3.5">
            <p class="text-[11px] font-bold text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-wider">Approved</p>
            <p class="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5"><span [appCountUp]="d.reviewApproved">0</span></p>
          </div>
          <div class="rounded-xl bg-rose-50 dark:bg-rose-900/20 ring-1 ring-inset ring-rose-100 dark:ring-rose-800/40 px-4 py-3.5">
            <p class="text-[11px] font-bold text-rose-600/80 dark:text-rose-400/80 uppercase tracking-wider">Rejected</p>
            <p class="text-2xl font-extrabold text-rose-700 dark:text-rose-300 mt-0.5"><span [appCountUp]="d.reviewRejected">0</span></p>
          </div>
          <div class="rounded-xl bg-violet-50 dark:bg-violet-900/20 ring-1 ring-inset ring-violet-100 dark:ring-violet-800/40 px-4 py-3.5">
            <p class="text-[11px] font-bold text-violet-600/80 dark:text-violet-400/80 uppercase tracking-wider">Changes Asked</p>
            <p class="text-2xl font-extrabold text-violet-700 dark:text-violet-300 mt-0.5"><span [appCountUp]="d.reviewModificationRequested">0</span></p>
          </div>
          <div class="rounded-xl bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-100 dark:ring-blue-800/40 px-4 py-3.5">
            <p class="text-[11px] font-bold text-blue-600/80 dark:text-blue-400/80 uppercase tracking-wider">Pending</p>
            <p class="text-2xl font-extrabold text-blue-700 dark:text-blue-300 mt-0.5"><span [appCountUp]="d.reviewPending">0</span></p>
          </div>
        </div>
      </section>
    }
  </div>

  <!-- ─── Reusable donut chart ──────────────────────────────── -->
  <ng-template #donutTpl let-segs="segs" let-center="center">
    @if (segs.length) {
      <div class="flex flex-col items-center gap-5">
        <div class="relative flex-shrink-0">
          <svg viewBox="0 0 160 160" class="w-36 h-36 animate-scale-in" role="img" aria-label="Distribution chart">
            <g transform="rotate(-90 80 80)">
              <circle cx="80" cy="80" r="60" fill="none" stroke="#eef1f6" stroke-width="18" />
              @for (s of segs; track s.label) {
                <circle cx="80" cy="80" r="60" fill="none" [attr.stroke]="s.color" stroke-width="18"
                        [attr.stroke-dasharray]="s.dash" [attr.stroke-dashoffset]="s.offset"
                        stroke-linecap="round" style="transition: stroke-dasharray .9s cubic-bezier(0.22,1,0.36,1)" />
              }
            </g>
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span class="text-2xl font-extrabold text-slate-800 dark:text-slate-100" [appCountUp]="center">0</span>
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
          </div>
        </div>
        <div class="w-full grid grid-cols-1 gap-1.5">
          @for (s of segs; track s.label) {
            <div class="flex items-center gap-2 text-xs min-w-0">
              <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" [style.background]="s.color"></span>
              <span class="text-slate-600 dark:text-slate-300 font-medium capitalize truncate flex-1 min-w-0">{{ s.label.toLowerCase() }}</span>
              <span class="text-slate-800 dark:text-slate-200 font-bold flex-shrink-0">{{ s.value }}</span>
              <span class="text-slate-400 w-9 text-right flex-shrink-0">{{ s.pct }}%</span>
            </div>
          }
        </div>
      </div>
    } @else {
      <div class="flex flex-col items-center justify-center py-10 text-slate-400">
        <span class="material-icons text-4xl mb-2" aria-hidden="true">donut_large</span>
        <span class="text-sm">No data yet</span>
      </div>
    }
  </ng-template>
  `,
})
export class MyAnalyticsComponent implements OnInit {
  private profileSvc = inject(ProfileService);

  data    = signal<MyAnalytics | null>(null);
  loading = signal(true);

  private readonly C = 2 * Math.PI * 60;

  private readonly STATUS_COLORS: Record<string, string> = {
    AI_PENDING: '#d946ef', DRAFT: '#94a3b8', READY_FOR_REVIEW: '#f59e0b', UNDER_REVIEW: '#3b82f6',
    MODIFICATION_REQUESTED: '#8b5cf6', APPROVED: '#10b981', REJECTED: '#ef4444',
  };
  private readonly DIFF_COLORS: Record<string, string> = {
    EASY: '#10b981', MEDIUM: '#f59e0b', HARD: '#ef4444',
  };

  ngOnInit(): void {
    this.profileSvc.getMyAnalytics().subscribe({
      next: r => { this.data.set(r.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  approvalRate = computed(() => {
    const d = this.data();
    if (!d) return 0;
    const decided = d.approvedCount + d.rejectedCount;
    return decided ? Math.round((d.approvedCount / decided) * 100) : 0;
  });

  // Weekly trend bars
  trendTotal = computed(() => (this.data()?.authoredWeeklyTrend ?? []).reduce((a, w) => a + w.count, 0));
  trendBars = computed(() => {
    const t = this.data()?.authoredWeeklyTrend ?? [];
    const max = Math.max(1, ...t.map(w => w.count));
    return t.map(w => ({ count: w.count, pct: Math.round((w.count / max) * 100), label: this.weekLabel(w.week) }));
  });

  donut(map: Record<string, number> | undefined, kind: 'status' | 'diff'): DonutSegment[] {
    if (!map) return [];
    const entries = Object.entries(map).filter(([, v]) => v > 0);
    const total = entries.reduce((a, [, v]) => a + v, 0) || 1;
    let acc = 0;
    return entries.map(([k, v], i) => {
      const len = (v / total) * this.C;
      const seg: DonutSegment = {
        label: k.replace(/_/g, ' '), value: v, pct: Math.round((v / total) * 100),
        color: this.colorFor(kind, k), dash: `${len} ${this.C - len}`, offset: -acc,
      };
      acc += len;
      return seg;
    });
  }

  private colorFor(kind: 'status' | 'diff', key: string): string {
    return (kind === 'status' ? this.STATUS_COLORS[key] : this.DIFF_COLORS[key]) ?? '#a78bfa';
  }

  private weekLabel(week: string): string {
    const d = new Date(week + 'T00:00:00Z');
    if (isNaN(d.getTime())) return week;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
}
