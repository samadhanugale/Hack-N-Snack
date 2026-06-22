package com.accenture.smartquiz.dto.response;

import com.accenture.smartquiz.entity.enums.UserRole;

import java.util.List;

/** Current-user profile, including the user's own stack (skill) assignments. */
public record MeResponse(
        Long id,
        String enterpriseId,
        String fullName,
        String email,
        UserRole role,
        List<StackSummaryResponse> stacks
) {
}
