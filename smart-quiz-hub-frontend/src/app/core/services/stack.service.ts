import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, StackDetail, StackRequest, StackSummary, TopicDetail, TopicRequest, TopicResponse } from '../models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StackService {
  private base = `${environment.apiUrl}/stacks`;

  private http = inject(HttpClient);

  getStacks(): Observable<ApiResponse<StackSummary[]>> {
    return this.http.get<ApiResponse<StackSummary[]>>(this.base);
  }

  getTopics(stackId: number): Observable<ApiResponse<TopicResponse[]>> {
    return this.http.get<ApiResponse<TopicResponse[]>>(`${this.base}/${stackId}/topics`);
  }

  // Admin CRUD
  getAllStacksAdmin(): Observable<ApiResponse<StackDetail[]>> {
    return this.http.get<ApiResponse<StackDetail[]>>(`${this.base}/admin`);
  }

  createStack(req: StackRequest): Observable<ApiResponse<StackDetail>> {
    return this.http.post<ApiResponse<StackDetail>>(`${this.base}/admin`, req);
  }

  updateStack(id: number, req: StackRequest): Observable<ApiResponse<StackDetail>> {
    return this.http.put<ApiResponse<StackDetail>>(`${this.base}/admin/${id}`, req);
  }

  toggleStack(id: number): Observable<ApiResponse<StackDetail>> {
    return this.http.patch<ApiResponse<StackDetail>>(`${this.base}/admin/${id}/toggle`, {});
  }

  addTopic(stackId: number, req: TopicRequest): Observable<ApiResponse<TopicDetail>> {
    return this.http.post<ApiResponse<TopicDetail>>(`${this.base}/admin/${stackId}/topics`, req);
  }

  updateTopic(stackId: number, topicId: number, req: TopicRequest): Observable<ApiResponse<TopicDetail>> {
    return this.http.put<ApiResponse<TopicDetail>>(`${this.base}/admin/${stackId}/topics/${topicId}`, req);
  }

  toggleTopic(stackId: number, topicId: number): Observable<ApiResponse<TopicDetail>> {
    return this.http.patch<ApiResponse<TopicDetail>>(`${this.base}/admin/${stackId}/topics/${topicId}/toggle`, {});
  }
}
