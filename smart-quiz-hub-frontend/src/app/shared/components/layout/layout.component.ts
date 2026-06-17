import { Component, OnInit, OnDestroy, HostListener, computed, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
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
  private router = inject(Router);
  collapsed = signal(false);
  mobileOpen = signal(false);

  unreadCount = signal(0);
  notifications = signal<AppNotification[]>([]);
  bellOpen = signal(false);

  private pollSub?: Subscription;
  private eventSource?: EventSource;

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
    // Real-time push via Server-Sent Events (instant), with the poll below as a fallback.
    this.openNotificationStream();

    // Fallback poll for unread count (slowed to 60s now that SSE provides instant updates).
    this.pollSub = interval(60_000).pipe(
      startWith(0),
      switchMap(() => this.notifService.getUnreadCount())
    ).subscribe(count => this.unreadCount.set(count));
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    this.eventSource?.close();
  }

  /** Opens the SSE stream for live notifications. No-op when not logged in. */
  private openNotificationStream() {
    const token = this.auth.getToken();
    if (!token) return;

    this.eventSource = this.notifService.openStream(token);

    this.eventSource.addEventListener('notification', (event: MessageEvent) => {
      this.unreadCount.update(c => c + 1);

      let incoming: AppNotification | null = null;
      try {
        incoming = JSON.parse(event.data) as AppNotification;
      } catch {
        incoming = null;
      }

      if (this.bellOpen()) {
        // Panel is open: refresh the list from the server for accuracy.
        this.notifService.getNotifications(0, 10).subscribe(page => {
          this.notifications.set(page.content);
        });
      } else if (incoming) {
        // Panel closed: keep a fresh copy at the top for when it next opens.
        this.notifications.update(ns => [incoming as AppNotification, ...ns].slice(0, 10));
      }
    });

    // EventSource auto-reconnects on error by default; just log without spamming actions.
    this.eventSource.onerror = () => {
      // Connection dropped; the browser will retry automatically. The 60s poll covers the gap.
    };
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

  /** Mark read, close the panel, and deep-link to the relevant screen by type. */
  openNotification(n: AppNotification) {
    if (!n.read) this.markRead(n.id);
    this.bellOpen.set(false);
    const target = n.type === 'REVIEW_ASSIGNED' ? '/reviews' : '/questions';
    this.router.navigate([target]);
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
