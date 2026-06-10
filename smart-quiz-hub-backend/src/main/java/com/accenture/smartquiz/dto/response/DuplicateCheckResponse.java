package com.accenture.smartquiz.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * Result of an AI-driven duplicate / similarity check.
 *
 * <p>{@code duplicate} is true when {@code maxSimilarityPercent} reaches the
 * configured threshold (default 30%). In that case {@code similar} lists the
 * offending questions from the bank.</p>
 */
@Getter
@Builder
public class DuplicateCheckResponse {

    /** True when the candidate is too similar (>= threshold) to an existing question. */
    private boolean duplicate;

    /** Highest similarity found against any existing question, as a 0–100 percentage. */
    private double maxSimilarityPercent;

    /** The blocking threshold, as a whole percentage (e.g. 30). */
    private int thresholdPercent;

    /** Existing questions at or above the threshold, highest similarity first. */
    private List<SimilarQuestionResponse> similar;
}
