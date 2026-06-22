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
        boolean aiPowered,
        AnswerCheck answerCheck
) {

    /**
     * A single quality issue flagged against the question.
     *
     * @param severity INFO | WARNING | CRITICAL
     * @param message  human-readable description of the issue
     */
    public record Issue(String severity, String message) {
    }

    /**
     * The AI's verdict on the question's correct answer, plus an optional proposed fix the
     * user can accept to rewrite the options in one click.
     *
     * @param correctAnswerInOptions true if the actual correct answer appears among the current options
     * @param currentAnswerCorrect   true if the option(s) currently marked correct are actually right
     * @param correctAnswerText      the correct answer stated plainly (always provided)
     * @param proposedOptions        a corrected full option list to apply; empty when no change is needed
     * @param proposedCorrectIndices 0-based indices of the correct option(s) within {@code proposedOptions}
     */
    public record AnswerCheck(
            boolean correctAnswerInOptions,
            boolean currentAnswerCorrect,
            String correctAnswerText,
            List<String> proposedOptions,
            List<Integer> proposedCorrectIndices
    ) {
    }
}
