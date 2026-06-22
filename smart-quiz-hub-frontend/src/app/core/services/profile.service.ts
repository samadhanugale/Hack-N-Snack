import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, StackSummary, UserRole } from '../models';
import { environment } from '../../../environments/environment';

/** Current-user profile incl. their stack (skill) assignments. */
export interface MeProfile {
  id: number;
  enterpriseId: string;
  fullName: string;
  email: string;
  role: UserRole;
  stacks: StackSummary[];
}

/** Self-service profile API (`/users/me`). */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/users`;

  getMe(): Observable<ApiResponse<MeProfile>> {
    return this.http.get<ApiResponse<MeProfile>>(`${this.base}/me`);
  }

  updateMyStacks(stackIds: number[]): Observable<ApiResponse<MeProfile>> {
    return this.http.put<ApiResponse<MeProfile>>(`${this.base}/me/stacks`, { stackIds });
  }
}
