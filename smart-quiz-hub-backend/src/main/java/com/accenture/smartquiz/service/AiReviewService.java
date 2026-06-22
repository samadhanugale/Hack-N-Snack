package com.accenture.smartquiz.service;

import com.accenture.smartquiz.dto.response.AiReviewResponse;

/**
 * AI Review Assistant — given an existing MCQ, asks an LLM for a quality analysis
 * (score, suggested difficulty, issues, answer explanation, improvement tips) to help reviewers.
 *
 * <p>Implementations must never throw on AI failure: when the model is unavailable they fall
 * back to a deterministic heuristic analysis ({@code aiPowered = false}).</p>
 */
public interface AiReviewService {

    /**
     * Analyzes the question with the given id.
     *
     * @param questionId the MCQ id to review
     * @return an AI-powered analysis, or a heuristic one when the LLM is unavailable
     */
    AiReviewResponse analyze(Long questionId);
}
