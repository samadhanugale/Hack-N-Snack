package com.accenture.smartquiz.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DashboardStatsResponse {

    private long totalQuestions;
    private long draftCount;
    private long readyForReviewCount;
    private long underReviewCount;
    private long modificationRequestedCount;
    private long approvedCount;
    private long rejectedCount;

    // ── Reviewer workload (populated for SMEs; reflects the user's reviewer role) ──
    private long pendingReviewCount;   // assigned to me & still UNDER_REVIEW
    private long assignedToMeCount;    // every question ever assigned to me
    private long reviewedByMeCount;    // questions I've decided (approved + rejected + mod-requested)
    private long approvedByMeCount;
    private long rejectedByMeCount;
}
