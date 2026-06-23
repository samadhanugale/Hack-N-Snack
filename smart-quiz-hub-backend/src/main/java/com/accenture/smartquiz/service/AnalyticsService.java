package com.accenture.smartquiz.service;

import com.accenture.smartquiz.dto.response.AnalyticsOverviewResponse;
import com.accenture.smartquiz.dto.response.MyAnalyticsResponse;
import com.accenture.smartquiz.dto.response.QuestionAnalyticsResponse;
import com.accenture.smartquiz.dto.response.ReviewerWorkloadResponse;
import com.accenture.smartquiz.dto.response.SmeReportResponse;

import java.time.Instant;
import java.util.List;

public interface AnalyticsService {

    /** Overview within an optional [start, end) window. Null bounds mean unbounded. */
    AnalyticsOverviewResponse getOverview(Instant start, Instant end);

    /** Personal analytics for one user: their authoring stats + their reviewer activity. */
    MyAnalyticsResponse getMyAnalytics(Long userId);

    /** Per-SME performance report (Story 2.1) within an optional [start, end) window. */
    List<SmeReportResponse> getSmeReports(Instant start, Instant end);

    /** Question-performance analytics (Story 2.2) within an optional [start, end) window. */
    QuestionAnalyticsResponse getQuestionAnalytics(Instant start, Instant end);

    List<ReviewerWorkloadResponse> getReviewerWorkload();

    /** SME performance report rendered as a UTF-8 CSV document (Story 2.1 export). */
    byte[] exportSmeReportsCsv(Instant start, Instant end);

    /** Question analytics summary rendered as a UTF-8 CSV document (Story 2.2 export). */
    byte[] exportQuestionAnalyticsCsv(Instant start, Instant end);
}
