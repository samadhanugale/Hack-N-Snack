import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiResponse, AuthResponse, LoginRequest } from '../models';
import { environment } from '../../../environments/environment';

const TOKEN_KEY   = 'sqh_token';
const REFRESH_KEY = 'sqh_refresh_token';
const USER_KEY    = 'sqh_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<AuthResponse | null>(this.loadUser());

  readonly currentUser   = this._user.asReadonly();
  readonly isLoggedIn    = computed(() => this._user() !== null);
  readonly isAdmin       = computed(() => this._user()?.role === 'ADMIN');
  readonly isSme         = computed(() => this._user()?.role === 'SME');
  readonly currentUserId = computed(() => this._user()?.userId ?? null);

  private http = inject(HttpClient);
  private router = inject(Router);

  login(req: LoginRequest): Observable<ApiResponse<AuthResponse>> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/auth/login`, req)
      .pipe(
        tap(res => {
          if (res.success && res.data) {
            this.storeSession(res.data);
          }
        })
      );
  }

  /**
   * Exchanges the stored refresh token for a fresh access token (and a new
   * refresh token). Updates storage and the current-user signal on success.
   * Callers (the error interceptor) handle failures by logging out.
   */
  refresh(): Observable<ApiResponse<AuthResponse>> {
    const refreshToken = this.getRefreshToken();
    return this.http
      .post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/auth/refresh`, {
        refreshToken,
      })
      .pipe(
        tap(res => {
          if (res.success && res.data) {
            this.storeSession(res.data);
          }
        })
      );
  }

  changePassword(
    currentPassword: string,
    newPassword: string
  ): Observable<ApiResponse<void>> {
    const body: { currentPassword: string; newPassword: string } = {
      currentPassword,
      newPassword,
    };
    return this.http.post<ApiResponse<void>>(
      `${environment.apiUrl}/auth/change-password`,
      body
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  /** Persists tokens + user and refreshes the current-user signal. */
  private storeSession(data: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(data));
    this._user.set(data);
  }

  private loadUser(): AuthResponse | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }
}
