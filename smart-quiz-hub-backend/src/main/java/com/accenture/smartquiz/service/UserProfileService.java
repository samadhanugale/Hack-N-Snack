package com.accenture.smartquiz.service;

import com.accenture.smartquiz.dto.response.MeResponse;

import java.util.List;

/** Self-service profile operations for the currently authenticated user. */
public interface UserProfileService {

    MeResponse getMe(Long userId);

    MeResponse updateMyStacks(Long userId, List<Long> stackIds);
}
