import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { McqService } from '../../core/services/mcq.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardStats } from '../../core/models';
import { ButtonDirective } from '../../shared/components/button/button.directive';
import { CountUpDirective } from '../../shared/directives/count-up.directive';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, MatCardModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, ButtonDirective, CountUpDirective],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  mcqService = inject(McqService);
  auth       = inject(AuthService);

  stats   = signal<DashboardStats | null>(null);
  loading = signal(true);

  ngOnInit(): void {
    this.mcqService.getDashboardStats().subscribe({
      next: res => { this.stats.set(res.data); this.loading.set(false); },
      error: ()  => this.loading.set(false)
    });
  }

  get statCards() {
    const s = this.stats();
    if (!s) return [];
    return [
      { label: 'Total Questions', value: s.totalQuestions,      icon: 'quiz',         color: '#6366F1', status: null },
      { label: 'Draft',           value: s.draftCount,          icon: 'edit_note',    color: '#94A3B8', status: 'DRAFT' },
      { label: 'Ready for Review',value: s.readyForReviewCount, icon: 'pending',      color: '#F59E0B', status: 'READY_FOR_REVIEW' },
      { label: 'Under Review',    value: s.underReviewCount,    icon: 'rate_review',  color: '#3B82F6', status: 'UNDER_REVIEW' },
      { label: 'Approved',        value: s.approvedCount,       icon: 'check_circle', color: '#10B981', status: 'APPROVED' },
      { label: 'Rejected',        value: s.rejectedCount,       icon: 'cancel',       color: '#EF4444', status: 'REJECTED' },
    ];
  }

  /** Admin-only insight/report destinations. */
  get insightCards() {
    return [
      { label: 'Analytics',       desc: 'Trends, charts & KPIs',       icon: 'insights',      link: '/admin/analytics', color: '#6366F1' },
      { label: 'SME Reports',     desc: 'Reviewer performance',        icon: 'groups',        link: '/admin/analytics', color: '#8B5CF6' },
      { label: 'Question Bank',   desc: 'All questions & assignment',  icon: 'library_books', link: '/questions',       color: '#06B6D4' },
      { label: 'Administration',  desc: 'Users, stacks & topics',      icon: 'admin_panel_settings', link: '/admin',    color: '#10B981' },
    ];
  }
}
