package com.accenture.smartquiz.service.impl;

import com.accenture.smartquiz.dto.response.AuditLogResponse;
import com.accenture.smartquiz.dto.response.PagedResponse;
import com.accenture.smartquiz.entity.AuditLog;
import com.accenture.smartquiz.repository.AuditLogRepository;
import com.accenture.smartquiz.service.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditServiceImpl implements AuditService {

    private final AuditLogRepository auditRepo;

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(Long questionId, String action, Long userId, String userName, String details) {
        // Auditing is best-effort: it must never break the main business flow. The entry is
        // written in its own transaction (REQUIRES_NEW) so a failure here cannot mark the
        // caller's transaction rollback-only, and any exception is swallowed with a warning.
        try {
            auditRepo.save(AuditLog.builder()
                    .questionId(questionId)
                    .action(action)
                    .performedBy(userId)
                    .performedByName(userName)
                    .details(details)
                    .build());
        } catch (Exception e) {
            log.warn("Failed to record audit log [action={}, questionId={}]: {}",
                    action, questionId, e.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<AuditLogResponse> getForQuestion(Long questionId, Pageable pageable) {
        return PagedResponse.of(
                auditRepo.findByQuestionIdOrderByCreatedAtDesc(questionId, pageable)
                        .map(AuditLogResponse::from));
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<AuditLogResponse> getAll(Pageable pageable) {
        return PagedResponse.of(
                auditRepo.findAllByOrderByCreatedAtDesc(pageable)
                        .map(AuditLogResponse::from));
    }
}
