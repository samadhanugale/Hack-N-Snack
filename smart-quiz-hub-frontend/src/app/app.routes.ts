import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    loadComponent: () =>
      import('./shared/components/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then(m => m.ProfileComponent)
      },
      {
        path: 'questions',
        loadComponent: () =>
          import('./features/questions/questions-hub/questions-hub.component').then(m => m.QuestionsHubComponent)
      },
      {
        path: 'bulk-upload',
        loadComponent: () =>
          import('./features/questions/bulk-upload/bulk-upload.component').then(m => m.BulkUploadComponent)
      },
      {
        path: 'reviews',
        loadComponent: () =>
          import('./features/reviews/pending-reviews/pending-reviews.component').then(m => m.PendingReviewsComponent)
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/admin/admin-hub/admin-hub.component').then(m => m.AdminHubComponent)
      },
      {
        path: 'admin/analytics',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/analytics/analytics.component').then(m => m.AnalyticsComponent)
      },
      // ── Legacy paths → redirect to the consolidated screens ──
      { path: 'admin/questions', redirectTo: 'questions', pathMatch: 'full' },
      { path: 'admin/users',     redirectTo: 'admin',     pathMatch: 'full' },
      { path: 'admin/stacks',    redirectTo: 'admin',     pathMatch: 'full' },
      { path: 'admin/smes',      redirectTo: 'admin/analytics', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
