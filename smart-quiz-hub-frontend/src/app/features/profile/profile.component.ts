import { Component, inject, signal, computed } from '@angular/core';
import {
  FormBuilder,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { SnackService } from '../../core/services/snack.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ButtonDirective } from '../../shared/components/button/button.directive';

/** Cross-field validator: confirmPassword must equal newPassword. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const next = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return next && confirm && next !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, ButtonDirective],
  template: `
    <app-page-header
      icon="account_circle"
      title="My Profile"
      subtitle="Manage your account and password" />

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start animate-fade-up">

      <!-- ─── Profile card (read-only) ──────────────────────── -->
      <section class="card p-7 lg:col-span-2" aria-label="Account details">
        <div class="flex flex-col items-center text-center">
          <div class="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-3xl font-extrabold shadow-lg shadow-indigo-500/30">
            {{ user()?.fullName?.charAt(0)?.toUpperCase() }}
          </div>
          <h2 class="mt-4 text-xl font-extrabold text-slate-800 tracking-tight">{{ user()?.fullName }}</h2>
          <span class="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold ring-1 ring-inset ring-indigo-100">
            <span class="material-icons text-[14px]" aria-hidden="true">verified_user</span>
            {{ roleLabel() }}
          </span>
        </div>

        <dl class="mt-7 space-y-3">
          <div class="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span class="material-icons text-slate-400 text-[20px] flex-shrink-0" aria-hidden="true">badge</span>
            <div class="min-w-0">
              <dt class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Enterprise ID</dt>
              <dd class="text-sm font-semibold text-slate-700 truncate">{{ user()?.enterpriseId }}</dd>
            </div>
          </div>
          <div class="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span class="material-icons text-slate-400 text-[20px] flex-shrink-0" aria-hidden="true">mail</span>
            <div class="min-w-0">
              <dt class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</dt>
              <dd class="text-sm font-semibold text-slate-700 truncate">{{ user()?.email }}</dd>
            </div>
          </div>
          <div class="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span class="material-icons text-slate-400 text-[20px] flex-shrink-0" aria-hidden="true">workspace_premium</span>
            <div class="min-w-0">
              <dt class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role</dt>
              <dd class="text-sm font-semibold text-slate-700 truncate">{{ user()?.role }}</dd>
            </div>
          </div>
        </dl>
      </section>

      <!-- ─── Change password panel ─────────────────────────── -->
      <section class="card p-7 lg:col-span-3" aria-label="Change password">
        <div class="mb-6">
          <h2 class="text-lg font-extrabold text-slate-800 tracking-tight">Change Password</h2>
          <p class="text-slate-500 text-sm mt-0.5">Use at least 8 characters for your new password.</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-5">

          <!-- Current password -->
          <div>
            <label for="currentPassword" class="block text-sm font-bold text-slate-700 mb-2">Current password</label>
            <div class="relative">
              <span class="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] z-10" aria-hidden="true">lock</span>
              <input id="currentPassword" formControlName="currentPassword"
                     [type]="showCurrent() ? 'text' : 'password'"
                     autocomplete="current-password"
                     placeholder="••••••••"
                     [attr.aria-invalid]="ctrl('currentPassword').invalid && ctrl('currentPassword').touched"
                     aria-describedby="currentPassword-error"
                     class="field w-full pl-11 pr-12 py-3.5 text-sm" />
              <button type="button" (click)="showCurrent.set(!showCurrent())"
                      [attr.aria-label]="showCurrent() ? 'Hide password' : 'Show password'"
                      [attr.aria-pressed]="showCurrent()"
                      class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors z-10">
                <span class="material-icons text-[18px]" aria-hidden="true">{{ showCurrent() ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </div>
            @if (ctrl('currentPassword').hasError('required') && ctrl('currentPassword').touched) {
              <p id="currentPassword-error" role="alert" class="text-xs text-rose-500 mt-2 flex items-center gap-1 font-medium animate-fade-in">
                <span class="material-icons text-[13px]" aria-hidden="true">error</span> Current password is required
              </p>
            }
          </div>

          <!-- New password -->
          <div>
            <label for="newPassword" class="block text-sm font-bold text-slate-700 mb-2">New password</label>
            <div class="relative">
              <span class="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] z-10" aria-hidden="true">lock_reset</span>
              <input id="newPassword" formControlName="newPassword"
                     [type]="showNew() ? 'text' : 'password'"
                     autocomplete="new-password"
                     placeholder="••••••••"
                     [attr.aria-invalid]="ctrl('newPassword').invalid && ctrl('newPassword').touched"
                     aria-describedby="newPassword-error"
                     class="field w-full pl-11 pr-12 py-3.5 text-sm" />
              <button type="button" (click)="showNew.set(!showNew())"
                      [attr.aria-label]="showNew() ? 'Hide password' : 'Show password'"
                      [attr.aria-pressed]="showNew()"
                      class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors z-10">
                <span class="material-icons text-[18px]" aria-hidden="true">{{ showNew() ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </div>
            @if (ctrl('newPassword').hasError('required') && ctrl('newPassword').touched) {
              <p id="newPassword-error" role="alert" class="text-xs text-rose-500 mt-2 flex items-center gap-1 font-medium animate-fade-in">
                <span class="material-icons text-[13px]" aria-hidden="true">error</span> New password is required
              </p>
            } @else if (ctrl('newPassword').hasError('minlength') && ctrl('newPassword').touched) {
              <p id="newPassword-error" role="alert" class="text-xs text-rose-500 mt-2 flex items-center gap-1 font-medium animate-fade-in">
                <span class="material-icons text-[13px]" aria-hidden="true">error</span> Must be at least 8 characters
              </p>
            }
          </div>

          <!-- Confirm new password -->
          <div>
            <label for="confirmPassword" class="block text-sm font-bold text-slate-700 mb-2">Confirm new password</label>
            <div class="relative">
              <span class="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] z-10" aria-hidden="true">lock_reset</span>
              <input id="confirmPassword" formControlName="confirmPassword"
                     [type]="showConfirm() ? 'text' : 'password'"
                     autocomplete="new-password"
                     placeholder="••••••••"
                     [attr.aria-invalid]="(ctrl('confirmPassword').invalid || form.hasError('mismatch')) && ctrl('confirmPassword').touched"
                     aria-describedby="confirmPassword-error"
                     class="field w-full pl-11 pr-12 py-3.5 text-sm" />
              <button type="button" (click)="showConfirm.set(!showConfirm())"
                      [attr.aria-label]="showConfirm() ? 'Hide password' : 'Show password'"
                      [attr.aria-pressed]="showConfirm()"
                      class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors z-10">
                <span class="material-icons text-[18px]" aria-hidden="true">{{ showConfirm() ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </div>
            @if (ctrl('confirmPassword').hasError('required') && ctrl('confirmPassword').touched) {
              <p id="confirmPassword-error" role="alert" class="text-xs text-rose-500 mt-2 flex items-center gap-1 font-medium animate-fade-in">
                <span class="material-icons text-[13px]" aria-hidden="true">error</span> Please confirm your new password
              </p>
            } @else if (form.hasError('mismatch') && ctrl('confirmPassword').touched) {
              <p id="confirmPassword-error" role="alert" class="text-xs text-rose-500 mt-2 flex items-center gap-1 font-medium animate-fade-in">
                <span class="material-icons text-[13px]" aria-hidden="true">error</span> Passwords do not match
              </p>
            }
          </div>

          <div class="pt-1">
            <button type="submit" appBtn="primary"
                    [disabled]="form.invalid || loading()">
              @if (loading()) {
                <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Updating...
              } @else {
                <span class="material-icons text-[18px]" aria-hidden="true">save</span>
                Update Password
              }
            </button>
          </div>
        </form>
      </section>
    </div>
  `,
})
export class ProfileComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private snack = inject(SnackService);

  user = this.auth.currentUser;

  roleLabel = computed(() => {
    const role = this.auth.currentUser()?.role;
    if (role === 'ADMIN') return 'Administrator';
    if (role === 'SME') return 'Subject Matter Expert';
    return '';
  });

  loading = signal(false);
  showCurrent = signal(false);
  showNew = signal(false);
  showConfirm = signal(false);

  form = this.fb.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch }
  );

  ctrl(name: string): AbstractControl {
    return this.form.get(name)!;
  }

  submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);

    const { currentPassword, newPassword } = this.form.value;

    this.auth.changePassword(currentPassword!, newPassword!).subscribe({
      next: res => {
        if (res.success) {
          this.snack.success('Password updated successfully.');
          this.form.reset();
        } else {
          this.snack.error(res.message ?? 'Could not update password.');
        }
        this.loading.set(false);
      },
      error: err => {
        const msg = err.error?.message ?? 'Could not update password. Please try again.';
        this.snack.error(msg);
        this.loading.set(false);
      },
    });
  }
}
