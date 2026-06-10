package com.accenture.smartquiz.exception;

import com.accenture.smartquiz.dto.response.SimilarQuestionResponse;
import lombok.Getter;

import java.util.List;

/**
 * Thrown when an MCQ is too similar (>= threshold) to existing question(s).
 * Carries the offending matches so the API can surface actionable detail to
 * the SME (Level 2: "an error message is shown including details of questions
 * from the question bank that are similar").
 */
@Getter
public class DuplicateQuestionException extends RuntimeException {

    private final double maxSimilarityPercent;
    private final int thresholdPercent;
    private final List<SimilarQuestionResponse> similar;

    public DuplicateQuestionException(String message,
                                      double maxSimilarityPercent,
                                      int thresholdPercent,
                                      List<SimilarQuestionResponse> similar) {
        super(message);
        this.maxSimilarityPercent = maxSimilarityPercent;
        this.thresholdPercent = thresholdPercent;
        this.similar = similar == null ? List.of() : similar;
    }

    public DuplicateQuestionException(String message) {
        this(message, 0.0, 0, List.of());
    }
}
