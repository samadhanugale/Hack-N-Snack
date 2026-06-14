package com.accenture.smartquiz.dto.response;

import com.accenture.smartquiz.entity.enums.UserRole;

import java.time.Instant;
import java.util.List;

/** Full user record for the super-admin User Management module (Java 21 record). */
public record AdminUserResponse(
        Long id,
        String enterpriseId,
        String fullName,
        String email,
        UserRole role,
        boolean active,
        List<StackSummaryResponse> stacks,
        long totalQuestions,
        long approvedQuestions,
        long reviewedQuestions,
        Instant createdAt
) {}
