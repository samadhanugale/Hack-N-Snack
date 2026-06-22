import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ApiResponse, McqResponse, AiGenerateRequest,
  DuplicateCheckRequest, DuplicateCheckResponse
} from '../models';
import { environment } from '../../../environments/environment';

/** A single quality issue flagged by the AI Review Assistant. */
export interface AiReviewIssue {
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
}

/** AI verdict on the correct answer + an optional proposed corrected option set. */
export interface AiAnswerCheck {
  correctAnswerInOptions: boolean;   // is the genuinely-correct answer among the current options?
  currentAnswerCorrect: boolean;     // are the currently-marked correct option(s) actually right?
  correctAnswerText: string;         // the correct answer in plain words
  proposedOptions: string[];         // corrected full option list to apply (empty = no change)
  proposedCorrectIndices: number[];  // 0-based correct indices within proposedOptions
}

/** AI Review Assistant analysis of an MCQ. */
export interface AiReview {
  qualityScore: number;          // 0–100
  suggestedDifficulty: 'EASY' | 'MEDIUM' | 'HARD';
  summary: string;
  issues: AiReviewIssue[];
  answerExplanation: string;
  suggestions: string[];
  aiPowered: boolean;            // false → heuristic fallback (AI unavailable)
  answerCheck?: AiAnswerCheck;
}

/**
 * Level 2 AI features — available to both SMEs and Admins.
 * Backed by the /ai endpoints on the server.
 */
@Injectable({ providedIn: 'root' })
export class AiService {
  private base = `${environment.apiUrl}/ai`;

  private http = inject(HttpClient);

  /** Generate MCQs with AI. Duplicates (>= threshold) are auto-replaced server-side. */
  generate(req: AiGenerateRequest): Observable<ApiResponse<McqResponse[]>> {
    return this.http.post<ApiResponse<McqResponse[]>>(`${this.base}/generate`, req);
  }

  /** Check a candidate MCQ for duplicates within the same stack & topic. */
  duplicateCheck(req: DuplicateCheckRequest): Observable<ApiResponse<DuplicateCheckResponse>> {
    return this.http.post<ApiResponse<DuplicateCheckResponse>>(`${this.base}/duplicate-check`, req);
  }

  /** AI Review Assistant — request an LLM quality analysis of an existing question. */
  reviewQuestion(questionId: number): Observable<ApiResponse<AiReview>> {
    return this.http.post<ApiResponse<AiReview>>(`${this.base}/review/${questionId}`, {});
  }
}
