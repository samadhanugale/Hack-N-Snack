import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiResponse, AuthResponse, LoginRequest } from '../models';
import { environment } from '../../../environments/environment';

const TOKEN_KEY = 'sqh_token';
const USER_KEY  = 'sqh_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<AuthResponse | null>(this.loadUser());

  readonly currentUser   = this._user.asReadonly();
  readonly isLoggedIn    = computed(() => this._user() !== null);
  readonly isAdmin       = computed(() => this._user()?.role === 'ADMIN');
  readonly isSme         = computed(() => this._user()?.role === 'SME');
  readonly currentUserId = computed(() => this._user()?.userId ?? null);

  constructor(private http: HttpClient, private router: Router) {}

  login(req: LoginRequest): Observable<ApiResponse<AuthResponse>> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/auth/login`, req)
      .pipe(
        tap(res => {
          if (res.success && res.data) {
            localStorage.setItem(TOKEN_KEY, res.data.token);
            localStorage.setItem(USER_KEY, JSON.stringify(res.data));
            this._user.set(res.data);
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
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private loadUser(): AuthResponse | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }
}
