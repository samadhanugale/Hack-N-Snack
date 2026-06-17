import { Component, signal } from '@angular/core';
import { UserManagementComponent } from '../user-management/user-management.component';
import { StackManagementComponent } from '../stack-management/stack-management.component';

type ATab = 'users' | 'stacks';

/**
 * Administration hub — consolidates user management and the stack/topic taxonomy
 * behind a single nav entry with tabs.
 */
@Component({
  selector: 'app-admin-hub',
  standalone: true,
  imports: [UserManagementComponent, StackManagementComponent],
  template: `
    <div class="mb-6 animate-fade-up">
      <h1 class="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
        <span class="material-icons text-indigo-600" aria-hidden="true">admin_panel_settings</span>
        Administration
      </h1>
      <p class="text-slate-500 text-sm mt-1">Manage users and the technology-stack taxonomy</p>
    </div>

    <div class="inline-flex gap-1 card p-1.5 mb-6 animate-fade-up" role="tablist" aria-label="Administration sections">
      @for (t of tabs; track t.id) {
        <button type="button" role="tab" [attr.aria-selected]="tab() === t.id" (click)="tab.set(t.id)"
                [class]="'press inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ' +
                         (tab() === t.id ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50')">
          <span class="material-icons text-[18px]" aria-hidden="true">{{ t.icon }}</span>
          <span>{{ t.label }}</span>
        </button>
      }
    </div>

    @if (tab() === 'users') {
      <app-user-management />
    } @else {
      <app-stack-management />
    }
  `,
})
export class AdminHubComponent {
  tab = signal<ATab>('users');

  tabs: { id: ATab; label: string; icon: string }[] = [
    { id: 'users',  label: 'Users',           icon: 'group' },
    { id: 'stacks', label: 'Stacks & Topics', icon: 'layers' },
  ];
}
