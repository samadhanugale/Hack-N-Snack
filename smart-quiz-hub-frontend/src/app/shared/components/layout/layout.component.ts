import { Component, OnInit, OnDestroy, HostListener, computed, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../.././../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AppNotification } from '../../../core/models';
import { Subscription, interval } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';

interface NavItem {
  icon: string;
  label: string;
  route: string;
  adminOnly?: boolean;
  smeOnly?: boolean;
  exact?: boolean;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './layout.component.html',
})
export class LayoutComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  notifService = inject(NotificationService);
  collapsed = signal(false);
  mobileOpen = signal(false);

  unreadCount = signal(0);
  notifications = signal<AppNotification[]>([]);
  bellOpen = signal(false);

  private pollSub?: Subscription;

  /** Close transient overlays (bell dropdown, mobile drawer) on Escape. */
  @HostListener('document:keydown.escape')
  onEscape() {
    this.bellOpen.set(false);
    this.mobileOpen.set(false);
  }

  navItems: NavItem[] = [
    { icon: 'dashboard',     label: 'Dashboard',       route: '/dashboard',       exact: true },
    { icon: 'quiz',          label: 'Questions',       route: '/questions' },
    { icon: 'rate_review',   label: 'Pending Reviews', route: '/reviews' },
    { icon: 'insights',      label: 'Analytics',       route: '/admin/analytics', adminOnly: true },
    { icon: 'admin_panel_settings', label: 'Administration', route: '/admin', adminOnly: true, exact: true }
  ];

  visibleItems = computed(() =>
    this.navItems.filter(i =>
      (!i.adminOnly || this.auth.isAdmin()) &&
      (!i.smeOnly   || !this.auth.isAdmin())
    )
  );

  ngOnInit() {
    // Poll for unread count every 30 seconds
    this.pollSub = interval(30_000).pipe(
      startWith(0),
      switchMap(() => this.notifService.getUnreadCount())
    ).subscribe(count => this.unreadCount.set(count));
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
  }

  toggleBell() {
    this.bellOpen.update(v => !v);
    if (this.bellOpen()) {
      this.notifService.getNotifications(0, 10).subscribe(page => {
        this.notifications.set(page.content);
      });
    }
  }

  markRead(id: number) {
    this.notifService.markRead(id).subscribe(() => {
      this.notifications.update(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
      this.unreadCount.update(c => Math.max(0, c - 1));
    });
  }

  markAllRead() {
    this.notifService.markAllRead().subscribe(() => {
      this.notifications.update(ns => ns.map(n => ({ ...n, read: true })));
      this.unreadCount.set(0);
    });
  }

  notifIcon(type: string): string {
    switch (type) {
      case 'REVIEW_ASSIGNED':   return 'assignment';
      case 'QUESTION_APPROVED': return 'check_circle';
      case 'QUESTION_REJECTED': return 'cancel';
      default:                  return 'notifications';
    }
  }

  notifColor(type: string): string {
    switch (type) {
      case 'REVIEW_ASSIGNED':   return 'text-blue-400';
      case 'QUESTION_APPROVED': return 'text-green-400';
      case 'QUESTION_REJECTED': return 'text-red-400';
      default:                  return 'text-slate-400';
    }
  }

  user = this.auth.currentUser;

  roleLabel = computed(() => {
    const role = this.auth.currentUser()?.role;
    if (role === 'ADMIN') return 'Administrator';
    if (role === 'SME')   return 'Subject Matter Expert';
    return '';
  });
}
