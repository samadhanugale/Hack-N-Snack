import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../models';
import { environment } from '../../../environments/environment';

/** A single comment in a question's review discussion thread. */
export interface QuestionComment {
  id: number;
  questionId: number;
  authorName: string;
  authorRole: string | null;
  body: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class CommentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/questions`;

  /** Discussion thread for a question (oldest first). Access enforced server-side. */
  getComments(questionId: number): Observable<QuestionComment[]> {
    return this.http
      .get<ApiResponse<QuestionComment[]>>(`${this.base}/${questionId}/comments`)
      .pipe(map(r => r.data));
  }

  /** Appends a comment to a question's thread and returns the saved comment. */
  addComment(questionId: number, body: string): Observable<QuestionComment> {
    return this.http
      .post<ApiResponse<QuestionComment>>(`${this.base}/${questionId}/comments`, { body })
      .pipe(map(r => r.data));
  }
}
