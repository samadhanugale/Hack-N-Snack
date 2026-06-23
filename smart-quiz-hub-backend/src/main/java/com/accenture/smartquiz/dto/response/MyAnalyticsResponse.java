package com.accenture.smartquiz.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.Map;

/**
 * Personal analytics for the current user (SME): their own authoring stats plus their
 * reviewer activity. Scoped entirely to the logged-in user — no org-wide data.
 */
@Getter
@Builder
public class MyAnalyticsResponse {

    // ── Authoring (questions I created) ──────────────────────────────────────
    private long authoredTotal;
    private Map<String, Long> authoredByStatus;       // key = McqStatus name (all seeded with 0)
    private Map<String, Long> authoredByDifficulty;   // key = Difficulty name
    private List<AnalyticsOverviewResponse.WeeklyCount> authoredWeeklyTrend;
    private long approvedCount;
    private long rejectedCount;

    // ── Reviewing (decisions I made / work assigned to me) ───────────────────
    private long reviewApproved;
    private long reviewRejected;
    private long reviewModificationRequested;
    private long reviewPending;   // currently assigned to me and UNDER_REVIEW
}
