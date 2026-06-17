package com.accenture.smartquiz.dto.response;

import com.accenture.smartquiz.entity.AuditLog;

import java.time.Instant;

/** A single audit-trail entry exposed to the UI. */
public record AuditLogResponse(
        Long id,
        Long questionId,
        String action,
        String performedByName,
        String details,
        Instant createdAt) {

    public static AuditLogResponse from(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getQuestionId(),
                log.getAction(),
                log.getPerformedByName(),
                log.getDetails(),
                log.getCreatedAt());
    }
}
