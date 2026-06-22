package com.accenture.smartquiz.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * AI Review Assistant result for a single MCQ.
 *
 * <p>Returned by {@code POST /ai/review/{questionId}}. When the LLM is reachable the
 * fields are populated from the model's analysis ({@code aiPowered = true}); otherwise a
 * deterministic heuristic analysis is returned ({@code aiPowered = false}) so the feature
 * always yields a usable response.</p>
 *
 * @param qualityScore       overall question quality, 0–100
 * @param suggestedDifficulty EASY | MEDIUM | HARD
 * @param summary            one-sentence assessment
 * @param issues             flagged problems (may be empty)
 * @param answerExplanation  why the correct option(s) are right
 * @param suggestions        short improvement tips (may be empty)
 * @param aiPowered          true when produced by the LLM, false for the heuristic fallback
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiReviewResponse(
        int qualityScore,
        String suggestedDifficulty,
        String summary,
        List<Issue> issues,
        String answerExplanation,
        List<String> suggestions,
        boolean aiPowered
) {

    /**
     * A single quality issue flagged against the question.
     *
     * @param severity INFO | WARNING | CRITICAL
     * @param message  human-readable description of the issue
     */
    public record Issue(String severity, String message) {
    }
}
