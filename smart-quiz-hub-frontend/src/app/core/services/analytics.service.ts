import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  AnalyticsDateRange, AnalyticsOverview, ApiResponse,
  QuestionAnalytics, ReviewerWorkload, SmeReport
} from '../models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/analytics`;

  getOverview(range?: AnalyticsDateRange): Observable<AnalyticsOverview> {
    return this.http
      .get<ApiResponse<AnalyticsOverview>>(`${this.base}/overview`, { params: this.rangeParams(range) })
      .pipe(map(r => r.data));
  }

  getSmeReports(range?: AnalyticsDateRange): Observable<SmeReport[]> {
    return this.http
      .get<ApiResponse<SmeReport[]>>(`${this.base}/sme-reports`, { params: this.rangeParams(range) })
      .pipe(map(r => r.data));
  }

  getQuestionAnalytics(range?: AnalyticsDateRange): Observable<QuestionAnalytics> {
    return this.http
      .get<ApiResponse<QuestionAnalytics>>(`${this.base}/questions`, { params: this.rangeParams(range) })
      .pipe(map(r => r.data));
  }

  getReviewerWorkload(): Observable<ReviewerWorkload[]> {
    return this.http
      .get<ApiResponse<ReviewerWorkload[]>>(`${this.base}/reviewer-workload`)
      .pipe(map(r => r.data));
  }

  exportSmeReports(range?: AnalyticsDateRange): Observable<Blob> {
    return this.http.get(`${this.base}/sme-reports/export`, {
      params: this.rangeParams(range),
      responseType: 'blob'
    });
  }

  exportQuestionAnalytics(range?: AnalyticsDateRange): Observable<Blob> {
    return this.http.get(`${this.base}/questions/export`, {
      params: this.rangeParams(range),
      responseType: 'blob'
    });
  }

  private rangeParams(range?: AnalyticsDateRange): HttpParams {
    let p = new HttpParams();
    if (range?.startDate) p = p.set('startDate', range.startDate);
    if (range?.endDate) p = p.set('endDate', range.endDate);
    return p;
  }
}
