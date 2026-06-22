import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminUser } from '../../../core/models';
import { UserAdminService } from '../../../core/services/user-admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { SnackService } from '../../../core/services/snack.service';
import { ButtonDirective } from '../../../shared/components/button/button.directive';
import { TableHeaderCellComponent } from '../../../shared/components/table-header-cell/table-header-cell.component';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { CountUpDirective } from '../../../shared/directives/count-up.directive';
import { applyFilters, applySort, FilterOption, SortState } from '../../../shared/utils/table-ops';
import { UserFormDialogComponent } from './user-form-dialog.component';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

function userValue(u: AdminUser, key: string): string {
  switch (key) {
    case 'name':       return u.fullName ?? '';
    case 'enterprise': return u.enterpriseId ?? '';
    case 'email':      return u.email ?? '';
    case 'role':       return u.role ?? '';
    case 'status':     return u.active ? 'Active' : 'Inactive';
    case 'created':    return u.createdAt ?? '';
    default:           return '';
  }
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    FormsModule, MatDialogModule, MatTooltipModule,
    ButtonDirective, TableHeaderCellComponent, RelativeTimePipe, CountUpDirective,
  ],
  templateUrl: './user-management.component.html',
})
export class UserManagementComponent implements OnInit {
  private userSvc = inject(UserAdminService);
  private dialog  = inject(MatDialog);
  private auth    = inject(AuthService);
  private snack   = inject(SnackService);
  private confirm = inject(ConfirmService);

  allRows  = signal<AdminUser[]>([]);
  loading  = signal(true);
  page     = signal(0);
  pageSize = signal(10);
  search   = signal('');

  sort    = signal<SortState>({ key: 'name', dir: 'asc' });
  filters = signal<Record<string, string | null>>({ role: null, status: null });

  readonly roleOptions: FilterOption[] = [
    { value: 'SME', label: 'SME' },
    { value: 'ADMIN', label: 'Admin' },
  ];
  readonly statusOptions: FilterOption[] = [
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' },
  ];

  private searched = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.allRows();
    return this.allRows().filter(u =>
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.enterpriseId.toLowerCase().includes(q));
  });
  private filtered = computed(() => applyFilters(this.searched(), this.filters(), userValue));
  private sorted   = computed(() => applySort(this.filtered(), this.sort(), userValue));

  totalElements = computed(() => this.filtered().length);
  totalPages    = computed(() => Math.max(1, Math.ceil(this.totalElements() / this.pageSize())));
  rows = computed(() => {
    const start = this.page() * this.pageSize();
    return this.sorted().slice(start, start + this.pageSize());
  });
  activeFilterCount = computed(() => Object.values(this.filters()).filter(v => v != null).length);

  stats = computed(() => {
    const all = this.allRows();
    return {
      total:  all.length,
      admins: all.filter(u => u.role === 'ADMIN').length,
      smes:   all.filter(u => u.role === 'SME').length,
      active: all.filter(u => u.active).length,
    };
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.userSvc.list().subscribe({
      next: users => { this.allRows.set(users); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  setSort(s: SortState): void { this.sort.set(s); this.page.set(0); }
  setFilter(key: string, value: string | null): void { this.filters.update(f => ({ ...f, [key]: value })); this.page.set(0); }
  clearFilters(): void { this.filters.set({ role: null, status: null }); this.search.set(''); this.page.set(0); }
  filterByRole(role: string | null): void { this.filters.update(f => ({ ...f, role })); this.page.set(0); }
  prevPage(): void { if (this.page() > 0) this.page.update(p => p - 1); }
  nextPage(): void { if (this.page() < this.totalPages() - 1) this.page.update(p => p + 1); }

  isSelf(u: AdminUser): boolean { return u.id === this.auth.currentUserId(); }

  roleBadge(role: string): string {
    const base = 'inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide';
    return role === 'ADMIN' ? `${base} bg-indigo-50 text-indigo-700 border border-indigo-200`
                            : `${base} bg-cyan-50 text-cyan-700 border border-cyan-200`;
  }
  statusBadge(active: boolean): string {
    const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide';
    return active ? `${base} bg-emerald-50 text-emerald-700 border border-emerald-200`
                  : `${base} bg-slate-100 text-slate-500`;
  }

  openCreate(): void {
    this.dialog.open(UserFormDialogComponent, { data: {}, maxWidth: '560px', width: '100%' })
      .afterClosed().subscribe(r => { if (r) this.load(); });
  }
  openEdit(u: AdminUser): void {
    this.dialog.open(UserFormDialogComponent, { data: { user: u }, maxWidth: '560px', width: '100%' })
      .afterClosed().subscribe(r => { if (r) this.load(); });
  }

  toggleActive(u: AdminUser): void {
    this.userSvc.setActive(u.id, !u.active).subscribe({
      next: () => { this.snack.success(u.active ? 'User deactivated' : 'User activated'); this.load(); },
      error: err => this.snack.error(err.error?.message ?? 'Failed'),
    });
  }

  resetPassword(u: AdminUser): void {
    const pw = window.prompt(`Set a new password for ${u.fullName} (min 8 characters):`);
    if (pw == null) return;
    if (pw.length < 8) { this.snack.error('Password must be at least 8 characters'); return; }
    this.userSvc.resetPassword(u.id, pw).subscribe({
      next: () => this.snack.success('Password reset'),
      error: err => this.snack.error(err.error?.message ?? 'Failed'),
    });
  }

  delete(u: AdminUser): void {
    this.confirm.ask({
      title: 'Delete user?',
      message: `${u.fullName} (${u.enterpriseId}) will be removed. If they have authored or reviewed questions, they'll be deactivated instead.`,
      confirmText: 'Delete', variant: 'danger', icon: 'person_remove',
    }).then(ok => {
      if (!ok) return;
      this.userSvc.delete(u.id).subscribe({
        next: () => { this.snack.success('User deleted'); this.load(); },
        error: err => this.snack.error(err.error?.message ?? 'Failed'),
      });
    });
  }
}
