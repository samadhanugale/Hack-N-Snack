import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiResponse, PagedResponse } from '../models';
import { environment } from '../../../environments/environment';

/** A single audit-trail entry ("who changed what, when"). */
export interface AuditLog {
  id: number;
  questionId: number | null;
  action: string;
  performedByName: string | null;
  details: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/audit`;

  /** Audit history for one question (newest first). Read-only — any authenticated user. */
  getForQuestion(questionId: number, page = 0, size = 20): Observable<PagedResponse<AuditLog>> {
    return this.http
      .get<ApiResponse<PagedResponse<AuditLog>>>(
        `${this.base}/question/${questionId}?page=${page}&size=${size}`)
      .pipe(map(r => r.data));
  }

  /** Global audit trail across all questions (Admin only, newest first). */
  getAll(page = 0, size = 20): Observable<PagedResponse<AuditLog>> {
    return this.http
      .get<ApiResponse<PagedResponse<AuditLog>>>(`${this.base}?page=${page}&size=${size}`)
      .pipe(map(r => r.data));
  }
}
