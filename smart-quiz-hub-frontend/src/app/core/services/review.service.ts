import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ApiResponse, PagedResponse, McqResponse, ReviewRequest,
  AssignReviewerRequest, BulkAssignRequest, BulkAssignResponse
} from '../models';
import { environment } from '../../../environments/environment';

/** Inline request body for POST /reviews/questions/bulk-decision (admin only). */
export interface BulkDecisionRequest {
  questionIds: number[];
  /** APPROVED | REJECTED | MODIFICATION_REQUESTED */
  decision: string;
  /** Required when decision is REJECTED or MODIFICATION_REQUESTED. */
  comments?: string;
}

/** Inline response shape for POST /reviews/questions/bulk-decision. */
export interface BulkDecisionResponse {
  processed: number;
  skipped: number;
  skippedReasons: string[];
}

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private base = `${environment.apiUrl}/reviews`;

  private http = inject(HttpClient);

  assignReviewer(questionId: number, req: AssignReviewerRequest): Observable<ApiResponse<McqResponse>> {
    return this.http.post<ApiResponse<McqResponse>>(
      `${this.base}/questions/${questionId}/assign`, req);
  }

  bulkAssignReviewer(req: BulkAssignRequest): Observable<ApiResponse<BulkAssignResponse>> {
    return this.http.post<ApiResponse<BulkAssignResponse>>(
      `${this.base}/questions/bulk-assign`, req);
  }

  submitReview(questionId: number, req: ReviewRequest): Observable<ApiResponse<McqResponse>> {
    return this.http.post<ApiResponse<McqResponse>>(
      `${this.base}/questions/${questionId}/decision`, req);
  }

  bulkDecision(questionIds: number[], decision: string, comments?: string):
      Observable<ApiResponse<BulkDecisionResponse>> {
    const req: BulkDecisionRequest = { questionIds, decision, comments };
    return this.http.post<ApiResponse<BulkDecisionResponse>>(
      `${this.base}/questions/bulk-decision`, req);
  }

  getPendingReviews(page = 0, size = 10): Observable<ApiResponse<PagedResponse<McqResponse>>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ApiResponse<PagedResponse<McqResponse>>>(`${this.base}/pending`, { params });
  }

  getReadyForReview(page = 0, size = 10): Observable<ApiResponse<PagedResponse<McqResponse>>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ApiResponse<PagedResponse<McqResponse>>>(`${this.base}/ready`, { params });
  }

  getReviewedByMe(page = 0, size = 10): Observable<ApiResponse<PagedResponse<McqResponse>>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ApiResponse<PagedResponse<McqResponse>>>(`${this.base}/reviewed`, { params });
  }

  autoAssignReviewers(): Observable<ApiResponse<null>> {
    return this.http.post<ApiResponse<null>>(`${this.base}/auto-assign`, {});
  }
}
