package com.accenture.smartquiz.dto.response;

import com.accenture.smartquiz.entity.QuestionComment;

import java.time.Instant;

/** A single comment in a question's review discussion thread, exposed to the UI. */
public record CommentResponse(
        Long id,
        Long questionId,
        String authorName,
        String authorRole,
        String body,
        Instant createdAt) {

    public static CommentResponse from(QuestionComment comment) {
        return new CommentResponse(
                comment.getId(),
                comment.getQuestionId(),
                comment.getAuthorName(),
                comment.getAuthorRole(),
                comment.getBody(),
                comment.getCreatedAt());
    }
}
