package com.accenture.smartquiz.service;

import com.accenture.smartquiz.dto.response.AuditLogResponse;
import com.accenture.smartquiz.dto.response.PagedResponse;
import org.springframework.data.domain.Pageable;

public interface AuditService {

    /**
     * Records an audit entry for a question mutation. Implementations MUST be resilient:
     * a failure here must never break the calling business flow.
     *
     * @param questionId the affected question (may be null)
     * @param action     e.g. CREATED, UPDATED, SUBMITTED, ASSIGNED, APPROVED, REJECTED,
     *                   MODIFICATION_REQUESTED, DELETED
     * @param userId     id of the acting user (may be null)
     * @param userName   denormalized name snapshot of the acting user (may be null)
     * @param details    optional human-readable detail
     */
    void record(Long questionId, String action, Long userId, String userName, String details);

    PagedResponse<AuditLogResponse> getForQuestion(Long questionId, Pageable pageable);

    PagedResponse<AuditLogResponse> getAll(Pageable pageable);
}
