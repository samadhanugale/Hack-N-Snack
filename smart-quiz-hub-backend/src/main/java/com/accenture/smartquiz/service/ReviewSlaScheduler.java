package com.accenture.smartquiz.service;

import com.accenture.smartquiz.entity.McqQuestion;
import com.accenture.smartquiz.entity.User;
import com.accenture.smartquiz.entity.enums.McqStatus;
import com.accenture.smartquiz.entity.enums.NotificationType;
import com.accenture.smartquiz.entity.enums.UserRole;
import com.accenture.smartquiz.repository.McqQuestionRepository;
import com.accenture.smartquiz.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Review SLA engine. Periodically scans in-flight review assignments (UNDER_REVIEW with a
 * reviewer and an active SLA clock) and:
 * <ul>
 *   <li>reminds the assigned reviewer once a review sits idle past the reminder threshold;</li>
 *   <li>escalates to all admins once it crosses the (longer) escalation threshold.</li>
 * </ul>
 *
 * The clock is {@code assignedAt} (set/reset by {@code ReviewServiceImpl} on each assignment).
 * {@code reminderSentAt} / {@code escalatedAt} make each notification fire at most once per
 * assignment, so re-runs are idempotent.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ReviewSlaScheduler {

    private final McqQuestionRepository mcqRepo;
    private final UserRepository userRepo;
    private final NotificationService notificationService;

    @Value("${app.review.sla.enabled:true}")
    private boolean enabled;

    @Value("${app.review.sla.reminder-hours:24}")
    private long reminderHours;

    @Value("${app.review.sla.escalation-hours:48}")
    private long escalationHours;

    /** Runs every {@code app.review.sla.interval-ms} (default 30 min) after the previous run finishes. */
    @Scheduled(fixedDelayString = "${app.review.sla.interval-ms:1800000}")
    @Transactional
    public void enforceSla() {
        if (!enabled) {
            return;
        }

        Instant now = Instant.now();
        List<McqQuestion> inFlight =
                mcqRepo.findByStatusAndReviewerIsNotNullAndAssignedAtIsNotNull(McqStatus.UNDER_REVIEW);

        int reminded = 0;
        int escalated = 0;
        int failed = 0;

        for (McqQuestion question : inFlight) {
            try {
                long hours = Duration.between(question.getAssignedAt(), now).toHours();

                if (hours >= escalationHours && question.getEscalatedAt() == null) {
                    escalateToAdmins(question, hours);
                    question.setEscalatedAt(now);
                    mcqRepo.save(question);
                    escalated++;
                } else if (hours >= reminderHours && question.getReminderSentAt() == null) {
                    remindReviewer(question, hours);
                    question.setReminderSentAt(now);
                    mcqRepo.save(question);
                    reminded++;
                }
            } catch (Exception ex) {
                failed++;
                log.error("Review SLA: failed processing question {} — {}",
                        question.getId(), ex.getMessage(), ex);
            }
        }

        log.info("Review SLA run: {} scanned, {} reminded, {} escalated, {} failed",
                inFlight.size(), reminded, escalated, failed);
    }

    /** Pushes a reminder to the assigned reviewer for an overdue (but not yet escalated) review. */
    private void remindReviewer(McqQuestion question, long hours) {
        User reviewer = question.getReviewer();
        notificationService.push(reviewer.getId(),
                NotificationType.REVIEW_REMINDER,
                "Review reminder",
                "Question #" + question.getId() + " (\"" + snippet(question.getQuestionStem())
                        + "\") has been awaiting your review for " + hours + "h. Please complete it soon.",
                question.getId());
    }

    /** Pushes an escalation to every active admin for a very-overdue review. */
    private void escalateToAdmins(McqQuestion question, long hours) {
        String reviewerName = question.getReviewer() != null
                ? question.getReviewer().getFullName() : "unassigned";
        String message = "Question #" + question.getId() + " (\"" + snippet(question.getQuestionStem())
                + "\") assigned to " + reviewerName + " has been UNDER_REVIEW for " + hours
                + "h with no decision.";

        List<User> admins = userRepo.findByRoleAndActiveTrue(UserRole.ADMIN);
        for (User admin : admins) {
            notificationService.push(admin.getId(),
                    NotificationType.REVIEW_ESCALATED,
                    "Review overdue",
                    message,
                    question.getId());
        }
    }

    private String snippet(String stem) {
        if (stem == null) return "";
        return stem.length() > 80 ? stem.substring(0, 80) + "…" : stem;
    }
}
