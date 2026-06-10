package com.accenture.smartquiz.dto.response;

import com.accenture.smartquiz.entity.enums.McqStatus;
import lombok.Builder;
import lombok.Getter;

/**
 * One existing question that is similar to the candidate, shown to the SME so
 * they can see exactly what their MCQ collides with.
 */
@Getter
@Builder
public class SimilarQuestionResponse {

    private Long id;
    private String questionStem;
    private String stackName;
    private String topicName;
    private McqStatus status;

    /** Similarity to the candidate, expressed as a 0–100 percentage. */
    private double similarityPercent;
}
