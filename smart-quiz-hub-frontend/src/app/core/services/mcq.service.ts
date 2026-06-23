import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiResponse, PagedResponse, McqResponse, McqRequest,
  DashboardStats, BulkUploadResponse, McqStatus, Difficulty
} from '../models';
import { environment } from '../../../environments/environment';

/** Backend-supported sort fields for the paged question list endpoints. */
export type McqSortField = 'updatedAt' | 'createdAt' | 'difficulty' | 'status';

/** Query options for the server-side paged question list endpoints. */
export interface McqListQuery {
  status?: McqStatus;
  stackId?: number;
  difficulty?: Difficulty;
  search?: string;
  sort?: McqSortField;
  direction?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class McqService {
  private base = `${environment.apiUrl}/questions`;

  private http = inject(HttpClient);

  createQuestion(req: McqRequest): Observable<ApiResponse<McqResponse>> {
    return this.http.post<ApiResponse<McqResponse>>(this.base, req);
  }

  updateQuestion(id: number, req: McqRequest): Observable<ApiResponse<McqResponse>> {
    return this.http.put<ApiResponse<McqResponse>>(`${this.base}/${id}`, req);
  }

  getQuestion(id: number): Observable<ApiResponse<McqResponse>> {
    return this.http.get<ApiResponse<McqResponse>>(`${this.base}/${id}`);
  }

  getMyQuestions(filters: McqListQuery = {}): Observable<ApiResponse<PagedResponse<McqResponse>>> {
    return this.http.get<ApiResponse<PagedResponse<McqResponse>>>(`${this.base}/my`, {
      params: this.buildListParams(filters),
    });
  }

  getAllQuestions(filters: McqListQuery = {}): Observable<ApiResponse<PagedResponse<McqResponse>>> {
    return this.http.get<ApiResponse<PagedResponse<McqResponse>>>(this.base, {
      params: this.buildListParams(filters),
    });
  }

  /** Shared query-param builder for the server-side paged list endpoints. */
  private buildListParams(f: McqListQuery): HttpParams {
    let params = new HttpParams()
      .set('page', f.page ?? 0)
      .set('size', f.size ?? 10);
    if (f.status)     params = params.set('status', f.status);
    if (f.stackId)    params = params.set('stackId', f.stackId);
    if (f.difficulty) params = params.set('difficulty', f.difficulty);
    if (f.search?.trim()) params = params.set('search', f.search.trim());
    if (f.sort)      params = params.set('sort', f.sort);
    if (f.direction) params = params.set('direction', f.direction);
    return params;
  }

  submitForReview(id: number): Observable<ApiResponse<McqResponse>> {
    return this.http.post<ApiResponse<McqResponse>>(`${this.base}/${id}/submit`, {});
  }

  /** Accept an AI-generated question (AI_PENDING → DRAFT) so it joins the creator's drafts. */
  acceptAiQuestion(id: number): Observable<ApiResponse<McqResponse>> {
    return this.http.post<ApiResponse<McqResponse>>(`${this.base}/${id}/accept`, {});
  }

  deleteQuestion(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.base}/${id}`);
  }

  getDashboardStats(): Observable<ApiResponse<DashboardStats>> {
    return this.http.get<ApiResponse<DashboardStats>>(`${this.base}/dashboard/stats`);
  }

  bulkUpload(file: File): Observable<ApiResponse<BulkUploadResponse>> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ApiResponse<BulkUploadResponse>>(`${this.base}/bulk-upload`, form);
  }

  /** Downloads the XLSX import template (same layout as export). */
  downloadImportTemplate(): Observable<Blob> {
    return this.http.get(`${this.base}/import-template`, { responseType: 'blob' });
  }

  searchQuestions(query: string): Observable<McqResponse[]> {
    const params = new HttpParams().set('q', query);
    return this.http
      .get<ApiResponse<McqResponse[]>>(`${this.base}/search`, { params })
      .pipe(map(r => r.data ?? []));
  }

  exportQuestions(filters: { stackId?: number; topicId?: number; difficulty?: Difficulty; status?: McqStatus } = {}): Observable<Blob> {
    let params = new HttpParams();
    if (filters.stackId)    params = params.set('stackId', filters.stackId);
    if (filters.topicId)    params = params.set('topicId', filters.topicId);
    if (filters.difficulty) params = params.set('difficulty', filters.difficulty);
    if (filters.status)     params = params.set('status', filters.status);
    return this.http.get(`${this.base}/export`, {
      params,
      responseType: 'blob'
    });
  }
}
