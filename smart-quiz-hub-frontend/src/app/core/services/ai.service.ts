import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ApiResponse, McqResponse, AiGenerateRequest,
  DuplicateCheckRequest, DuplicateCheckResponse
} from '../models';
import { environment } from '../../../environments/environment';

/**
 * Level 2 AI features — available to both SMEs and Admins.
 * Backed by the /ai endpoints on the server.
 */
@Injectable({ providedIn: 'root' })
export class AiService {
  private base = `${environment.apiUrl}/ai`;

  constructor(private http: HttpClient) {}

  /** Generate MCQs with AI. Duplicates (>= threshold) are auto-replaced server-side. */
  generate(req: AiGenerateRequest): Observable<ApiResponse<McqResponse[]>> {
    return this.http.post<ApiResponse<McqResponse[]>>(`${this.base}/generate`, req);
  }

  /** Check a candidate MCQ for duplicates within the same stack & topic. */
  duplicateCheck(req: DuplicateCheckRequest): Observable<ApiResponse<DuplicateCheckResponse>> {
    return this.http.post<ApiResponse<DuplicateCheckResponse>>(`${this.base}/duplicate-check`, req);
  }
}
