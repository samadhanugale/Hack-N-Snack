import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyticsService } from '../../core/services/analytics.service';
import { SnackService } from '../../core/services/snack.service';
import { AnalyticsOverview, QuestionAnalytics, ReviewerWorkload, SmeReport } from '../../core/models';
import { ButtonDirective } from '../../shared/components/button/button.directive';
import { CountUpDirective } from '../../shared/directives/count-up.directive';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

type Tab = 'global' | 'users' | 'questions';

interface DonutSegment { label: string; value: number; pct: number; color: string; dash: string; offset: number; }
interface BarRow { label: string; value: number; pct: number; color: string; }

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, ButtonDirective, CountUpDirective, PageHeaderComponent],
  templateUrl: './analytics.component.html',
})
export class AnalyticsComponent implements OnInit {
  private analyticsSvc = inject(AnalyticsService);
  private snack = inject(SnackService);

  tab = signal<Tab>('global');

  overview          = signal<AnalyticsOverview | null>(null);
  questionAnalytics = signal<QuestionAnalytics | null>(null);
  smeReports        = signal<SmeReport[]>([]);
  workload          = signal<ReviewerWorkload[]>([]);
  loading           = signal(true);

  startDate = signal<string | null>(null);
  endDate   = signal<string | null>(null);

  protected readonly Math = Math;
  // SVG donut geometry (r = 60 → circumference)
  private readonly R = 60;
  readonly C = 2 * Math.PI * 60;

  private readonly STATUS_COLORS: Record<string, string> = {
    DRAFT: '#94a3b8', READY_FOR_REVIEW: '#f59e0b', UNDER_REVIEW: '#3b82f6',
    MODIFICATION_REQUESTED: '#8b5cf6', APPROVED: '#10b981', REJECTED: '#ef4444',
  };
  private readonly DIFF_COLORS: Record<string, string> = {
    EASY: '#10b981', MEDIUM: '#f59e0b', HARD: '#ef4444',
  };
  private readonly STACK_PALETTE = ['#6366f1','#8b5cf6','#ec4899','#06b6d4','#10b981','#f59e0b','#3b82f6','#f43f5e'];

  ngOnInit(): void { this.load(); }

  setTab(t: Tab): void { this.tab.set(t); }

  load(): void {
    this.loading.set(true);
    const range = { startDate: this.startDate(), endDate: this.endDate() };
    let done = 0;
    const finish = () => { if (++done === 4) this.loading.set(false); };
    this.analyticsSvc.getOverview(range).subscribe({ next: d => this.overview.set(d), complete: finish, error: finish });
    this.analyticsSvc.getQuestionAnalytics(range).subscribe({ next: d => this.questionAnalytics.set(d), complete: finish, error: finish });
    this.analyticsSvc.getSmeReports(range).subscribe({ next: d => this.smeReports.set(d ?? []), complete: finish, error: finish });
    this.analyticsSvc.getReviewerWorkload().subscribe({ next: d => this.workload.set(d ?? []), complete: finish, error: finish });
  }

  applyRange(): void { this.load(); }
  resetRange(): void { this.startDate.set(null); this.endDate.set(null); this.load(); }
  get hasRange(): boolean { return !!(this.startDate() || this.endDate()); }

  // ── CSV export ───────────────────────────────────────────────
  exportSme(): void {
    this.analyticsSvc
      .exportSmeReports({ startDate: this.startDate(), endDate: this.endDate() })
      .subscribe({
        next: blob => {
          this.downloadBlob(blob, 'sme-reports.csv');
          this.snack.success('SME reports exported');
        },
        error: () => this.snack.error('Failed to export SME reports'),
      });
  }

  exportQuestions(): void {
    this.analyticsSvc
      .exportQuestionAnalytics({ startDate: this.startDate(), endDate: this.endDate() })
      .subscribe({
        next: blob => {
          this.downloadBlob(blob, 'question-analytics.csv');
          this.snack.success('Question analytics exported');
        },
        error: () => this.snack.error('Failed to export question analytics'),
      });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Global KPIs ──────────────────────────────────────────────
  totalQuestions = computed(() => {
    const d = this.overview();
    return d ? Object.values(d.byStatus).reduce((a, b) => a + b, 0) : 0;
  });
  approvedCount = computed(() => this.overview()?.byStatus['APPROVED'] ?? 0);
  pendingCount  = computed(() => {
    const d = this.overview();
    return d ? (d.byStatus['READY_FOR_REVIEW'] ?? 0) + (d.byStatus['UNDER_REVIEW'] ?? 0) : 0;
  });
  globalApprovalRate = computed(() => {
    const a = this.approvedCount();
    const rej = this.overview()?.byStatus['REJECTED'] ?? 0;
    const decided = a + rej;
    return decided ? Math.round((a / decided) * 100) : 0;
  });

  // ── Chart geometry helpers ───────────────────────────────────
  private colorFor(kind: 'status' | 'diff' | 'stack', key: string, i: number): string {
    if (kind === 'status') return this.STATUS_COLORS[key] ?? '#a78bfa';
    if (kind === 'diff') return this.DIFF_COLORS[key] ?? '#a78bfa';
    return this.STACK_PALETTE[i % this.STACK_PALETTE.length];
  }

  donut(map: Record<string, number> | undefined, kind: 'status' | 'diff'): DonutSegment[] {
    if (!map) return [];
    const entries = Object.entries(map).filter(([, v]) => v > 0);
    const total = entries.reduce((a, [, v]) => a + v, 0) || 1;
    let acc = 0;
    return entries.map(([k, v], i) => {
      const len = (v / total) * this.C;
      const seg: DonutSegment = {
        label: k.replace(/_/g, ' '), value: v, pct: Math.round((v / total) * 100),
        color: this.colorFor(kind, k, i), dash: `${len} ${this.C - len}`, offset: -acc,
      };
      acc += len;
      return seg;
    });
  }

  bars(map: Record<string, number> | undefined, kind: 'status' | 'diff' | 'stack'): BarRow[] {
    if (!map) return [];
    const entries = Object.entries(map);
    const max = Math.max(1, ...entries.map(([, v]) => v));
    return entries
      .sort((a, b) => b[1] - a[1])
      .map(([k, v], i) => ({
        label: k.replace(/_/g, ' '), value: v,
        pct: Math.round((v / max) * 100), color: this.colorFor(kind, k, i),
      }));
  }

  // Weekly trend → SVG path strings over a 300×100 viewBox
  private trendXY(): { x: number; y: number }[] {
    const t = this.overview()?.weeklyTrend ?? [];
    if (!t.length) return [];
    const max = Math.max(1, ...t.map(w => w.count));
    const n = t.length;
    return t.map((w, i) => ({
      x: n === 1 ? 150 : (i / (n - 1)) * 300,
      y: 95 - (w.count / max) * 82,
    }));
  }
  trendLine = computed(() => this.trendXY().map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
  trendArea = computed(() => {
    const pts = this.trendXY();
    if (!pts.length) return '';
    const line = pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return `M${pts[0].x.toFixed(1)},100 ${line} L${pts[pts.length - 1].x.toFixed(1)},100 Z`;
  });
  trendPoints = computed(() => this.trendXY());
  trendLabels = computed(() => this.overview()?.weeklyTrend?.map(w => w.week) ?? []);
  hasTrend = computed(() => (this.overview()?.weeklyTrend?.length ?? 0) > 0);

  // ── Users tab ────────────────────────────────────────────────
  maxWorkload = computed(() => Math.max(1, ...this.workload().map(w => w.pendingCount)));
  topAuthors = computed(() => [...this.smeReports()].sort((a, b) => b.authoredCount - a.authoredCount).slice(0, 3));

  initials(name: string): string {
    return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  }
  rateColor(rate: number): string {
    if (rate >= 75) return '#10b981';
    if (rate >= 50) return '#f59e0b';
    return '#ef4444';
  }
}
