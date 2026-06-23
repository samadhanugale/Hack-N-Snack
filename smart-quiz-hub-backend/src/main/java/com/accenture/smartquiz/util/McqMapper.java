package com.accenture.smartquiz.util;

import com.accenture.smartquiz.dto.response.McqResponse;
import com.accenture.smartquiz.dto.response.SimilarQuestionResponse;
import com.accenture.smartquiz.entity.McqQuestion;

public final class McqMapper {

    private McqMapper() {}

    /** Round a 0.0–1.0 score to a 0–100 percentage with one decimal place. */
    public static double toPercent(double score) {
        return Math.round(score * 1000.0) / 10.0;
    }

    public static SimilarQuestionResponse toSimilarResponse(McqQuestion q, double score) {
        return SimilarQuestionResponse.builder()
                .id(q.getId())
                .questionStem(q.getQuestionStem())
                .stackName(q.getStack().getStackName())
                .topicName(q.getTopic().getTopicName())
                .status(q.getStatus())
                .similarityPercent(toPercent(score))
                .build();
    }

    public static McqResponse toResponse(McqQuestion q) {
        return McqResponse.builder()
                .id(q.getId())
                .questionStem(q.getQuestionStem())
                .options(q.getOptions())
                .correctOptionIndices(q.getCorrectOptionIndices())
                .difficulty(q.getDifficulty())
                .stackId(q.getStack().getId())
                .stackName(q.getStack().getStackName())
                .topicId(q.getTopic().getId())
                .topicName(q.getTopic().getTopicName())
                .status(q.getStatus())
                .creatorId(q.getCreator().getId())
                .creatorName(q.getCreator().getFullName())
                .reviewerId(q.getReviewer() != null ? q.getReviewer().getId() : null)
                .reviewerName(q.getReviewer() != null ? q.getReviewer().getFullName() : null)
                .reviewerComments(q.getReviewerComments())
                .aiSimilarityScore(q.getAiSimilarityScore())
                .aiGenerated(q.isAiGenerated())
                .createdAt(q.getCreatedAt())
                .updatedAt(q.getUpdatedAt())
                .assignedAt(q.getAssignedAt())
                .build();
    }
}
