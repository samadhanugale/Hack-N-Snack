import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AdminUser, StackSummary, UserRole } from '../../../core/models';
import { UserAdminService } from '../../../core/services/user-admin.service';
import { StackService } from '../../../core/services/stack.service';
import { SnackService } from '../../../core/services/snack.service';
import { ButtonDirective } from '../../../shared/components/button/button.directive';

export interface UserFormData { user?: AdminUser; }

@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, ButtonDirective],
  template: `
    <div class="flex items-center justify-between px-7 pt-6 pb-4 border-b border-slate-100 animate-scale-in">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <span class="material-icons text-white text-[20px]">{{ isEdit ? 'manage_accounts' : 'person_add' }}</span>
        </div>
        <div>
          <h2 class="text-lg font-bold text-slate-900 leading-tight">{{ isEdit ? 'Edit User' : 'Add User' }}</h2>
          <p class="text-xs text-slate-400 mt-0.5">{{ isEdit ? 'Update profile, role & stacks' : 'Create an SME or admin account' }}</p>
        </div>
      </div>
      <button mat-dialog-close class="press w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
        <span class="material-icons text-[20px]">close</span>
      </button>
    </div>

    <mat-dialog-content class="block !p-0 !m-0 sm:min-w-[460px] max-h-[72vh] overflow-y-auto">
      <div class="px-7 py-5 space-y-4">

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.04em] mb-1.5">Enterprise ID <span class="text-rose-400">*</span></label>
            <input [(ngModel)]="form.enterpriseId" [disabled]="isEdit" class="field w-full h-[42px] px-3 !bg-slate-50 focus:!bg-white text-slate-800 text-sm" [class.opacity-60]="isEdit"
                   placeholder="e.g. jane.doe" />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.04em] mb-1.5">Role <span class="text-rose-400">*</span></label>
            <div class="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 w-full">
              @for (r of roles; track r) {
                <button type="button" (click)="form.role = r"
                        class="flex-1 h-9 rounded-lg text-sm font-semibold transition-all"
                        [class]="form.role === r ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'">
                  {{ r === 'ADMIN' ? 'Admin' : 'SME' }}
                </button>
              }
            </div>
          </div>
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.04em] mb-1.5">Full Name <span class="text-rose-400">*</span></label>
          <input [(ngModel)]="form.fullName" class="field w-full h-[42px] px-3 !bg-slate-50 focus:!bg-white text-slate-800 text-sm" placeholder="Jane Doe" />
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.04em] mb-1.5">Email <span class="text-rose-400">*</span></label>
          <input [(ngModel)]="form.email" type="email" class="field w-full h-[42px] px-3 !bg-slate-50 focus:!bg-white text-slate-800 text-sm" placeholder="jane.doe@accenture.com" />
        </div>

        @if (!isEdit) {
          <div>
            <label class="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.04em] mb-1.5">Temporary Password <span class="text-rose-400">*</span></label>
            <input [(ngModel)]="form.password" type="text" class="field w-full h-[42px] px-3 !bg-slate-50 focus:!bg-white text-slate-800 text-sm" placeholder="Min 8 characters" />
            <p class="text-[11px] text-slate-400 mt-1">The user can change it after first login.</p>
          </div>
        }

        @if (isEdit) {
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" [(ngModel)]="form.active" class="w-4 h-4 rounded accent-indigo-600" />
            <span class="text-sm font-medium text-slate-700">Active account</span>
          </label>
        }

        <div>
          <label class="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.04em] mb-1.5">Stacks <span class="text-slate-400 normal-case font-normal">(assign SME to stacks)</span></label>
          @if (stacks().length === 0) {
            <p class="text-xs text-slate-400">No stacks available.</p>
          } @else {
            <div class="flex flex-wrap gap-2">
              @for (s of stacks(); track s.id) {
                <button type="button" (click)="toggleStack(s.id)"
                        class="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                        [class]="selectedStacks.has(s.id)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'">
                  {{ s.stackName }}
                </button>
              }
            </div>
          }
        </div>
      </div>
    </mat-dialog-content>

    <div class="flex items-center justify-end gap-3 px-7 py-4 border-t border-slate-100 bg-slate-50/60">
      <button type="button" mat-dialog-close appBtn="secondary">Cancel</button>
      <button type="button" (click)="save()" [disabled]="!valid() || saving()" appBtn="primary">
        @if (saving()) {
          <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        }
        {{ isEdit ? 'Save Changes' : 'Create User' }}
      </button>
    </div>
  `,
})
export class UserFormDialogComponent implements OnInit {
  private userSvc  = inject(UserAdminService);
  private stackSvc = inject(StackService);
  private snack    = inject(SnackService);
  dialogRef = inject(MatDialogRef<UserFormDialogComponent>);
  data = inject<UserFormData>(MAT_DIALOG_DATA);

  readonly roles: UserRole[] = ['SME', 'ADMIN'];
  isEdit = !!this.data.user;
  saving = signal(false);
  stacks = signal<StackSummary[]>([]);
  selectedStacks = new Set<number>();

  form = {
    enterpriseId: this.data.user?.enterpriseId ?? '',
    fullName:     this.data.user?.fullName ?? '',
    email:        this.data.user?.email ?? '',
    password:     '',
    role:         (this.data.user?.role ?? 'SME') as UserRole,
    active:       this.data.user?.active ?? true,
  };

  ngOnInit(): void {
    this.stackSvc.getStacks().subscribe(res => this.stacks.set(res.data));
    this.data.user?.stacks?.forEach(s => this.selectedStacks.add(s.id));
  }

  toggleStack(id: number): void {
    this.selectedStacks.has(id) ? this.selectedStacks.delete(id) : this.selectedStacks.add(id);
  }

  valid(): boolean {
    const f = this.form;
    const base = !!(f.fullName.trim() && f.email.trim());
    return this.isEdit ? base : base && !!f.enterpriseId.trim() && f.password.length >= 8;
  }

  save(): void {
    if (!this.valid() || this.saving()) return;
    this.saving.set(true);
    const stackIds = [...this.selectedStacks];

    const obs = this.isEdit
      ? this.userSvc.update(this.data.user!.id, {
          fullName: this.form.fullName.trim(), email: this.form.email.trim(),
          role: this.form.role, active: this.form.active, stackIds,
        })
      : this.userSvc.create({
          enterpriseId: this.form.enterpriseId.trim(), fullName: this.form.fullName.trim(),
          email: this.form.email.trim(), password: this.form.password,
          role: this.form.role, stackIds,
        });

    obs.subscribe({
      next: res => {
        this.snack.success(this.isEdit ? 'User updated' : 'User created');
        this.dialogRef.close(res.data);
      },
      error: err => { this.snack.error(err.error?.message ?? 'Failed to save user'); this.saving.set(false); },
    });
  }
}
