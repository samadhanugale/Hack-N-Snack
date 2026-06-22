package com.accenture.smartquiz.service.impl;

import com.accenture.smartquiz.dto.response.AnalyticsOverviewResponse;
import com.accenture.smartquiz.dto.response.QuestionAnalyticsResponse;
import com.accenture.smartquiz.dto.response.ReviewerWorkloadResponse;
import com.accenture.smartquiz.dto.response.SmeReportResponse;
import com.accenture.smartquiz.entity.User;
import com.accenture.smartquiz.entity.enums.McqStatus;
import com.accenture.smartquiz.entity.enums.UserRole;
import com.accenture.smartquiz.repository.McqQuestionRepository;
import com.accenture.smartquiz.repository.UserRepository;
import com.accenture.smartquiz.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Comparator;

@Service
@RequiredArgsConstructor
public class AnalyticsServiceImpl implements AnalyticsService {

    private final McqQuestionRepository mcqRepo;
    private final UserRepository userRepo;

    /** Anything before this is "the beginning of time" for an open-ended lower bound. */
    private static final Instant MIN = Instant.EPOCH;

    private Instant startOrMin(Instant start) {
        return start != null ? start : MIN;
    }

    private Instant endOrNow(Instant end) {
        // exclusive upper bound; +1 day past now covers rows created during the request
        return end != null ? end : Instant.now().plus(Duration.ofDays(1));
    }

    @Override
    @Transactional(readOnly = true)
    public AnalyticsOverviewResponse getOverview(Instant start, Instant end) {
        Instant s = startOrMin(start);
        Instant e = endOrNow(end);

        // Status counts — seed every status with 0 so empty buckets still render
        Map<String, Long> byStatus = new LinkedHashMap<>();
        Arrays.stream(McqStatus.values()).forEach(st -> byStatus.put(st.name(), 0L));
        mcqRepo.countByStatusInRange(s, e)
                .forEach(r -> byStatus.put(((McqStatus) r[0]).name(), ((Number) r[1]).longValue()));

        Map<String, Long> byStack = toCountMap(mcqRepo.countByStackInRange(s, e));
        Map<String, Long> byDifficulty = toCountMap(mcqRepo.countByDifficultyInRange(s, e));

        // Zero-filled, continuous weekly series so the trend always renders (no gaps,
        // and never a single lonely point). Buckets are Mondays (matches date_trunc('week')).
        Map<String, Long> weeklyCounts = new HashMap<>();
        mcqRepo.weeklyCreationTrendInRange(s, e)
                .forEach(r -> weeklyCounts.put(r[0].toString(), ((Number) r[1]).longValue()));

        LocalDate endMonday = LocalDate.ofInstant(e, ZoneOffset.UTC)
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate startMonday = (start != null)
                ? LocalDate.ofInstant(start, ZoneOffset.UTC).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                : endMonday.minusWeeks(7);                       // default window: last 8 weeks
        if (ChronoUnit.WEEKS.between(startMonday, endMonday) > 25) {
            startMonday = endMonday.minusWeeks(25);              // cap series length
        }
        if (startMonday.isAfter(endMonday)) startMonday = endMonday;

        List<AnalyticsOverviewResponse.WeeklyCount> trend = new ArrayList<>();
        for (LocalDate wk = startMonday; !wk.isAfter(endMonday); wk = wk.plusWeeks(1)) {
            trend.add(AnalyticsOverviewResponse.WeeklyCount.builder()
                    .week(wk.toString())
                    .count(weeklyCounts.getOrDefault(wk.toString(), 0L))
                    .build());
        }

        return AnalyticsOverviewResponse.builder()
                .byStatus(byStatus)
                .byStack(byStack)
                .byDifficulty(byDifficulty)
                .weeklyTrend(trend)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<SmeReportResponse> getSmeReports(Instant start, Instant end) {
        Instant s = startOrMin(start);
        Instant e = endOrNow(end);

        Map<Long, Long> authored = toIdCountMap(mcqRepo.authoredCountsByCreator(s, e));
        Map<Long, Long> pending = toIdCountMap(mcqRepo.pendingCountsByReviewer());
        Map<Long, Double> turnaroundSecs = new HashMap<>();
        mcqRepo.avgTurnaroundSecondsByReviewer(s, e).forEach(r -> {
            if (r[0] != null && r[1] != null) {
                turnaroundSecs.put(((Number) r[0]).longValue(), ((Number) r[1]).doubleValue());
            }
        });

        // reviewerId -> (status -> count)
        Map<Long, Map<McqStatus, Long>> decisions = new HashMap<>();
        mcqRepo.reviewDecisionCountsByReviewer(s, e).forEach(r -> decisions
                .computeIfAbsent(((Number) r[0]).longValue(), k -> new HashMap<>())
                .put((McqStatus) r[1], ((Number) r[2]).longValue()));

        return userRepo.findByRoleAndActiveTrue(UserRole.SME).stream()
                .map(sme -> buildSmeReport(sme, authored, pending, turnaroundSecs, decisions))
                .sorted(Comparator
                        .comparingLong(SmeReportResponse::reviewedCount).reversed()
                        .thenComparing(Comparator.comparingLong(SmeReportResponse::authoredCount).reversed()))
                .toList();
    }

    private SmeReportResponse buildSmeReport(User sme,
                                             Map<Long, Long> authored,
                                             Map<Long, Long> pending,
                                             Map<Long, Double> turnaroundSecs,
                                             Map<Long, Map<McqStatus, Long>> decisions) {
        Long id = sme.getId();
        Map<McqStatus, Long> byStatus = decisions.getOrDefault(id, Map.of());
        long approved = byStatus.getOrDefault(McqStatus.APPROVED, 0L);
        long rejected = byStatus.getOrDefault(McqStatus.REJECTED, 0L);
        long modRequested = byStatus.getOrDefault(McqStatus.MODIFICATION_REQUESTED, 0L);
        long reviewed = approved + rejected + modRequested;

        double approvalRate = reviewed > 0 ? round1(approved * 100.0 / reviewed) : 0.0;
        Double avgHours = turnaroundSecs.containsKey(id)
                ? round1(turnaroundSecs.get(id) / 3600.0) : null;

        return new SmeReportResponse(
                id, sme.getFullName(),
                authored.getOrDefault(id, 0L),
                reviewed, approved, rejected, modRequested,
                approvalRate, avgHours,
                pending.getOrDefault(id, 0L));
    }

    @Override
    @Transactional(readOnly = true)
    public QuestionAnalyticsResponse getQuestionAnalytics(Instant start, Instant end) {
        Instant s = startOrMin(start);
        Instant e = endOrNow(end);

        Map<String, Long> byStatus = new LinkedHashMap<>();
        Arrays.stream(McqStatus.values()).forEach(st -> byStatus.put(st.name(), 0L));
        mcqRepo.countByStatusInRange(s, e)
                .forEach(r -> byStatus.put(((McqStatus) r[0]).name(), ((Number) r[1]).longValue()));

        Map<String, Long> byStack = toCountMap(mcqRepo.countByStackInRange(s, e));
        Map<String, Long> byDifficulty = toCountMap(mcqRepo.countByDifficultyInRange(s, e));

        long total = byStatus.values().stream().mapToLong(Long::longValue).sum();
        long approved = byStatus.getOrDefault(McqStatus.APPROVED.name(), 0L);
        long rejected = byStatus.getOrDefault(McqStatus.REJECTED.name(), 0L);
        long decided = approved + rejected;
        double approvalRate = decided > 0 ? round1(approved * 100.0 / decided) : 0.0;

        Double avgSim = mcqRepo.avgSimilarityInRange(s, e);
        Double avgSimPercent = avgSim != null ? round1(avgSim * 100.0) : null;

        return new QuestionAnalyticsResponse(
                total, byStatus, byStack, byDifficulty,
                approved, rejected, approvalRate, avgSimPercent);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReviewerWorkloadResponse> getReviewerWorkload() {
        return mcqRepo.reviewerWorkload().stream()
                .map(r -> ReviewerWorkloadResponse.builder()
                        .reviewerName((String) r[0])
                        .pendingCount(((Number) r[1]).longValue())
                        .build())
                .sorted((a, b) -> Long.compare(b.getPendingCount(), a.getPendingCount()))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] exportSmeReportsCsv(Instant start, Instant end) {
        List<SmeReportResponse> reports = getSmeReports(start, end);

        StringBuilder csv = new StringBuilder();
        csv.append(csvRow("SME Name", "Authored", "Reviewed", "Approved", "Rejected",
                "Modification Requested", "Approval Rate %", "Avg Turnaround (h)", "Pending"));
        for (SmeReportResponse r : reports) {
            csv.append(csvRow(
                    r.smeName(),
                    Long.toString(r.authoredCount()),
                    Long.toString(r.reviewedCount()),
                    Long.toString(r.approvedCount()),
                    Long.toString(r.rejectedCount()),
                    Long.toString(r.modificationRequestedCount()),
                    Double.toString(r.approvalRate()),
                    r.avgTurnaroundHours() != null ? Double.toString(r.avgTurnaroundHours()) : "",
                    Long.toString(r.pendingCount())));
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] exportQuestionAnalyticsCsv(Instant start, Instant end) {
        QuestionAnalyticsResponse a = getQuestionAnalytics(start, end);

        StringBuilder csv = new StringBuilder();
        csv.append(csvRow("Metric", "Value"));
        csv.append(csvRow("total", Long.toString(a.total())));
        csv.append(csvRow("approved", Long.toString(a.approvedCount())));
        csv.append(csvRow("rejected", Long.toString(a.rejectedCount())));
        csv.append(csvRow("approvalRate", Double.toString(a.approvalRate())));
        csv.append(csvRow("avgSimilarity",
                a.avgSimilarityPercent() != null ? Double.toString(a.avgSimilarityPercent()) : ""));

        csv.append("\r\n");
        csv.append(csvRow("Status", "Count"));
        a.byStatus().forEach((k, v) -> csv.append(csvRow(k, Long.toString(v))));

        csv.append("\r\n");
        csv.append(csvRow("Stack", "Count"));
        a.byStack().forEach((k, v) -> csv.append(csvRow(k, Long.toString(v))));

        csv.append("\r\n");
        csv.append(csvRow("Difficulty", "Count"));
        a.byDifficulty().forEach((k, v) -> csv.append(csvRow(k, Long.toString(v))));

        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /** Builds a single CSV record (CRLF-terminated) from already-escaped-or-raw cells. */
    private String csvRow(String... cells) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < cells.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(csvEscape(cells[i]));
        }
        return sb.append("\r\n").toString();
    }

    /** Quotes a value when it contains a comma, quote, or newline; doubles internal quotes. */
    private String csvEscape(String value) {
        if (value == null) return "";
        boolean mustQuote = value.contains(",") || value.contains("\"")
                || value.contains("\n") || value.contains("\r");
        if (!mustQuote) return value;
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    private Map<String, Long> toCountMap(List<Object[]> rows) {
        Map<String, Long> map = new LinkedHashMap<>();
        rows.forEach(r -> map.put(r[0].toString(), ((Number) r[1]).longValue()));
        return map;
    }

    private Map<Long, Long> toIdCountMap(List<Object[]> rows) {
        Map<Long, Long> map = new HashMap<>();
        rows.forEach(r -> {
            if (r[0] != null) {
                map.put(((Number) r[0]).longValue(), ((Number) r[1]).longValue());
            }
        });
        return map;
    }

    private double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
