package com.accenture.smartquiz.controller;

import com.accenture.smartquiz.dto.response.AnalyticsOverviewResponse;
import com.accenture.smartquiz.dto.response.ApiResponse;
import com.accenture.smartquiz.dto.response.QuestionAnalyticsResponse;
import com.accenture.smartquiz.dto.response.ReviewerWorkloadResponse;
import com.accenture.smartquiz.dto.response.SmeReportResponse;
import com.accenture.smartquiz.service.AnalyticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

@RestController
@RequestMapping("/analytics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Analytics", description = "System-wide question and reviewer analytics (Admin only)")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/overview")
    @Operation(summary = "Overview: questions by status / stack / difficulty + creation trend, "
            + "optionally bounded by startDate/endDate (ISO-8601, inclusive)")
    public ResponseEntity<ApiResponse<AnalyticsOverviewResponse>> overview(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(ApiResponse.success(
                analyticsService.getOverview(toStartInstant(startDate), toEndInstant(endDate))));
    }

    @GetMapping("/sme-reports")
    @Operation(summary = "Per-SME performance report: authored, reviewed, approval rate, "
            + "avg turnaround, current backlog (Story 2.1)")
    public ResponseEntity<ApiResponse<List<SmeReportResponse>>> smeReports(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(ApiResponse.success(
                analyticsService.getSmeReports(toStartInstant(startDate), toEndInstant(endDate))));
    }

    @GetMapping("/questions")
    @Operation(summary = "Question-performance analytics: distribution + approval rate over a date range (Story 2.2)")
    public ResponseEntity<ApiResponse<QuestionAnalyticsResponse>> questionAnalytics(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(ApiResponse.success(
                analyticsService.getQuestionAnalytics(toStartInstant(startDate), toEndInstant(endDate))));
    }

    @GetMapping("/reviewer-workload")
    @Operation(summary = "Pending question count per reviewer (sorted by load, desc)")
    public ResponseEntity<ApiResponse<List<ReviewerWorkloadResponse>>> reviewerWorkload() {
        return ResponseEntity.ok(ApiResponse.success(analyticsService.getReviewerWorkload()));
    }

    @GetMapping("/sme-reports/export")
    @Operation(summary = "Export the per-SME performance report as a CSV file, "
            + "optionally bounded by startDate/endDate (ISO-8601, inclusive)")
    public ResponseEntity<byte[]> exportSmeReports(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        byte[] csv = analyticsService.exportSmeReportsCsv(toStartInstant(startDate), toEndInstant(endDate));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"sme-reports.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    @GetMapping("/questions/export")
    @Operation(summary = "Export the question analytics summary (totals, distributions, "
            + "approval rate, avg similarity) as a CSV file, optionally bounded by startDate/endDate")
    public ResponseEntity<byte[]> exportQuestionAnalytics(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        byte[] csv = analyticsService.exportQuestionAnalyticsCsv(toStartInstant(startDate), toEndInstant(endDate));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"question-analytics.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    /** Start of the given day in UTC, or null when unbounded. */
    private Instant toStartInstant(LocalDate date) {
        return date == null ? null : date.atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    /** Exclusive upper bound = start of the day after endDate (so endDate is inclusive). */
    private Instant toEndInstant(LocalDate date) {
        return date == null ? null : date.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    }
}
