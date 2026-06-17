package com.accenture.smartquiz.service.impl;

import com.accenture.smartquiz.dto.request.AssignReviewerRequest;
import com.accenture.smartquiz.dto.request.BulkAssignRequest;
import com.accenture.smartquiz.dto.request.BulkDecisionRequest;
import com.accenture.smartquiz.dto.request.ReviewRequest;
import com.accenture.smartquiz.dto.response.BulkAssignResponse;
import com.accenture.smartquiz.dto.response.BulkDecisionResponse;
import com.accenture.smartquiz.dto.response.McqResponse;
import com.accenture.smartquiz.dto.response.PagedResponse;
import com.accenture.smartquiz.entity.McqQuestion;
import com.accenture.smartquiz.entity.User;
import com.accenture.smartquiz.entity.enums.McqStatus;
import com.accenture.smartquiz.entity.enums.UserRole;
import com.accenture.smartquiz.exception.InvalidStatusTransitionException;
import com.accenture.smartquiz.exception.ResourceNotFoundException;
import com.accenture.smartquiz.exception.UnauthorizedAccessException;
import com.accenture.smartquiz.repository.McqQuestionRepository;
import com.accenture.smartquiz.repository.UserRepository;
import com.accenture.smartquiz.security.SmartQuizUserDetails;
import com.accenture.smartquiz.entity.enums.NotificationType;
import com.accenture.smartquiz.service.NotificationService;
import com.accenture.smartquiz.service.ReviewService;
import com.accenture.smartquiz.util.McqMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReviewServiceImpl implements ReviewService {

    private final McqQuestionRepository mcqRepo;
    private final UserRepository userRepo;
    private final NotificationService notificationService;

    @Override
    @Transactional
    public McqResponse assignReviewer(Long questionId, AssignReviewerRequest request,
                                       SmartQuizUserDetails currentUser) {
        if (currentUser.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedAccessException("Only admins can assign reviewers");
        }

        McqQuestion question = findById(questionId);

        if (question.getStatus() != McqStatus.READY_FOR_REVIEW
                && question.getStatus() != McqStatus.UNDER_REVIEW) {
            throw new InvalidStatusTransitionException(
                    "Reviewer can only be assigned to questions in READY_FOR_REVIEW or UNDER_REVIEW status");
        }

        User reviewer = userRepo.findById(request.reviewerId())
                .orElseThrow(() -> new ResourceNotFoundException("User", request.reviewerId()));

        if (reviewer.getId().equals(question.getCreator().getId())) {
            throw new UnauthorizedAccessException("Creator cannot review their own question");
        }

        question.setReviewer(reviewer);
        // Keep UNDER_REVIEW as-is on reassign; promote READY_FOR_REVIEW to UNDER_REVIEW
        if (question.getStatus() == McqStatus.READY_FOR_REVIEW) {
            question.setStatus(McqStatus.UNDER_REVIEW);
        }
        question.setReviewerComments(null);

        log.info("Question {} assigned to reviewer {} by admin {}", questionId,
                reviewer.getId(), currentUser.getUserId());

        McqResponse saved = McqMapper.toResponse(mcqRepo.save(question));

        notificationService.push(reviewer.getId(),
                NotificationType.REVIEW_ASSIGNED,
                "Review Assignment",
                "You have been assigned to review question #" + questionId + ": \""
                        + truncate(question.getQuestionStem(), 80) + "\"",
                questionId);

        return saved;
    }

    @Override
    @Transactional
    public BulkAssignResponse bulkAssignReviewer(BulkAssignRequest request, SmartQuizUserDetails currentUser) {
        if (currentUser.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedAccessException("Only admins can assign reviewers");
        }

        User reviewer = userRepo.findById(request.reviewerId())
                .orElseThrow(() -> new ResourceNotFoundException("User", request.reviewerId()));

        int assigned = 0;
        List<String> skippedReasons = new ArrayList<>();

        for (Long questionId : request.questionIds()) {
            McqQuestion question = mcqRepo.findById(questionId).orElse(null);
            if (question == null) {
                skippedReasons.add("Question " + questionId + ": not found");
                continue;
            }
            if (question.getStatus() != McqStatus.READY_FOR_REVIEW
                    && question.getStatus() != McqStatus.UNDER_REVIEW) {
                skippedReasons.add("Question " + questionId + ": status is " + question.getStatus());
                continue;
            }
            if (reviewer.getId().equals(question.getCreator().getId())) {
                skippedReasons.add("Question " + questionId + ": reviewer is the creator");
                continue;
            }
            question.setReviewer(reviewer);
            if (question.getStatus() == McqStatus.READY_FOR_REVIEW) {
                question.setStatus(McqStatus.UNDER_REVIEW);
            }
            question.setReviewerComments(null);
            mcqRepo.save(question);
            assigned++;
        }

        log.info("Bulk assign: {} assigned, {} skipped by admin {}", assigned, skippedReasons.size(), currentUser.getUserId());

        return BulkAssignResponse.builder()
                .assigned(assigned)
                .skipped(skippedReasons.size())
                .skippedReasons(skippedReasons)
                .build();
    }

    @Override
    @Transactional
    public BulkDecisionResponse bulkDecision(BulkDecisionRequest request, SmartQuizUserDetails currentUser) {
        if (currentUser.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedAccessException("Only admins can bulk-decide reviews");
        }

        McqStatus decision = request.decision();
        // Same decision-value validation the single-decision path enforces.
        if (decision != McqStatus.APPROVED && decision != McqStatus.REJECTED
                && decision != McqStatus.MODIFICATION_REQUESTED) {
            throw new InvalidStatusTransitionException(
                    "Review decision must be APPROVED, REJECTED, or MODIFICATION_REQUESTED");
        }
        // Same comments-mandatory rule the single-decision path enforces — fail the whole
        // request up-front (a missing comment is a caller error, not a per-item condition).
        if ((decision == McqStatus.REJECTED || decision == McqStatus.MODIFICATION_REQUESTED)
                && (request.comments() == null || request.comments().isBlank())) {
            throw new IllegalArgumentException(
                    "Comments are mandatory when rejecting or requesting modifications");
        }

        int processed = 0;
        List<String> skippedReasons = new ArrayList<>();

        for (Long questionId : request.questionIds()) {
            McqQuestion question = mcqRepo.findById(questionId).orElse(null);
            if (question == null) {
                skippedReasons.add("Question " + questionId + ": not found");
                continue;
            }
            // Only questions currently UNDER_REVIEW can be decided (the single path also accepts
            // READY_FOR_REVIEW and promotes it; we mirror that to stay consistent).
            if (question.getStatus() != McqStatus.UNDER_REVIEW
                    && question.getStatus() != McqStatus.READY_FOR_REVIEW) {
                skippedReasons.add("Question " + questionId + ": status is " + question.getStatus());
                continue;
            }
            if (question.getStatus() == McqStatus.READY_FOR_REVIEW) {
                question.setStatus(McqStatus.UNDER_REVIEW);
            }
            // Reuse the same state-machine guard the single path uses.
            if (!question.getStatus().canTransitionTo(decision)) {
                skippedReasons.add("Question " + questionId + ": cannot transition "
                        + question.getStatus() + " -> " + decision);
                continue;
            }

            // Admin bulk authorization: the single-decision path requires the caller to be the
            // assigned reviewer. An admin may not be the assigned reviewer, so we do NOT apply that
            // check here. If no reviewer is set, attribute the decision to the acting admin so
            // reviewer_id is never left null; otherwise keep the existing assigned reviewer.
            if (question.getReviewer() == null) {
                userRepo.findById(currentUser.getUserId()).ifPresent(question::setReviewer);
            }

            question.setStatus(decision);
            question.setReviewerComments(request.comments());
            question.setReviewedAt(java.time.Instant.now());
            mcqRepo.save(question);

            // Same creator notification the single decision sends.
            notifyCreatorOfDecision(question, decision, request.comments());
            processed++;
        }

        log.info("Bulk decision {}: {} processed, {} skipped by admin {}",
                decision, processed, skippedReasons.size(), currentUser.getUserId());

        return BulkDecisionResponse.builder()
                .processed(processed)
                .skipped(skippedReasons.size())
                .skippedReasons(skippedReasons)
                .build();
    }

    @Override
    @Transactional
    public McqResponse startReview(Long questionId, SmartQuizUserDetails currentUser) {
        McqQuestion question = findById(questionId);

        if (!question.getReviewer().getId().equals(currentUser.getUserId())) {
            throw new UnauthorizedAccessException("You are not the assigned reviewer for this question");
        }
        if (question.getStatus() != McqStatus.READY_FOR_REVIEW) {
            throw new InvalidStatusTransitionException(question.getStatus(), McqStatus.UNDER_REVIEW);
        }

        question.setStatus(McqStatus.UNDER_REVIEW);
        return McqMapper.toResponse(mcqRepo.save(question));
    }

    @Override
    @Transactional
    public McqResponse submitReview(Long questionId, ReviewRequest request,
                                     SmartQuizUserDetails currentUser) {
        McqQuestion question = findById(questionId);

        if (!question.getReviewer().getId().equals(currentUser.getUserId())) {
            throw new UnauthorizedAccessException("You are not the assigned reviewer for this question");
        }
        if (question.getStatus() != McqStatus.UNDER_REVIEW
                && question.getStatus() != McqStatus.READY_FOR_REVIEW) {
            throw new InvalidStatusTransitionException(
                    "Question must be UNDER_REVIEW or READY_FOR_REVIEW to submit a review decision");
        }
        if (question.getStatus() == McqStatus.READY_FOR_REVIEW) {
            question.setStatus(McqStatus.UNDER_REVIEW);
        }

        McqStatus decision = request.decision();
        if (decision != McqStatus.APPROVED && decision != McqStatus.REJECTED
                && decision != McqStatus.MODIFICATION_REQUESTED) {
            throw new InvalidStatusTransitionException(
                    "Review decision must be APPROVED, REJECTED, or MODIFICATION_REQUESTED");
        }
        // Comments are mandatory for any decision that sends the question back to the creator.
        if ((decision == McqStatus.REJECTED || decision == McqStatus.MODIFICATION_REQUESTED)
                && (request.comments() == null || request.comments().isBlank())) {
            throw new IllegalArgumentException(
                    "Comments are mandatory when rejecting or requesting modifications");
        }
        if (!question.getStatus().canTransitionTo(decision)) {
            throw new InvalidStatusTransitionException(question.getStatus(), decision);
        }

        question.setStatus(decision);
        question.setReviewerComments(request.comments());
        question.setReviewedAt(java.time.Instant.now());

        log.info("Question {} {} by reviewer {}", questionId, decision,
                currentUser.getEnterpriseId());

        McqResponse result = McqMapper.toResponse(mcqRepo.save(question));

        notifyCreatorOfDecision(question, decision, request.comments());

        return result;
    }

    /** Notification payload derived from a review decision. */
    private record ReviewOutcome(NotificationType type, String title, String message) {}

    /** Pushes the creator the notification matching a review decision (shared by single + bulk paths). */
    private void notifyCreatorOfDecision(McqQuestion question, McqStatus decision, String comments) {
        Long questionId = question.getId();
        // Java 21 switch expression — routes each decision to its notification (Story 3.1).
        ReviewOutcome outcome = switch (decision) {
            case APPROVED -> new ReviewOutcome(
                    NotificationType.QUESTION_APPROVED, "Question Approved",
                    "Your question #" + questionId + " has been approved.");
            case REJECTED -> new ReviewOutcome(
                    NotificationType.QUESTION_REJECTED, "Question Rejected",
                    "Your question #" + questionId + " was rejected. Reviewer comments: "
                            + nullToEmpty(comments));
            case MODIFICATION_REQUESTED -> new ReviewOutcome(
                    NotificationType.MODIFICATION_REQUESTED, "Modifications Requested",
                    "Your question #" + questionId + " needs changes before approval. "
                            + "Reviewer comments: " + nullToEmpty(comments));
            default -> throw new InvalidStatusTransitionException(
                    "Unsupported review decision: " + decision);
        };
        notificationService.push(question.getCreator().getId(),
                outcome.type(), outcome.title(), outcome.message(), questionId);
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<McqResponse> getPendingReviews(SmartQuizUserDetails currentUser, Pageable pageable) {
        var statuses = List.of(McqStatus.READY_FOR_REVIEW, McqStatus.UNDER_REVIEW);
        var page = mcqRepo.findByReviewerIdAndStatusIn(currentUser.getUserId(), statuses, pageable);
        return PagedResponse.of(page.map(McqMapper::toResponse));
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<McqResponse> getReviewedByMe(SmartQuizUserDetails currentUser, Pageable pageable) {
        var statuses = List.of(McqStatus.APPROVED, McqStatus.REJECTED, McqStatus.MODIFICATION_REQUESTED);
        var page = mcqRepo.findByReviewerIdAndStatusIn(currentUser.getUserId(), statuses, pageable);
        return PagedResponse.of(page.map(McqMapper::toResponse));
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<McqResponse> getReadyForReview(SmartQuizUserDetails currentUser, Pageable pageable) {
        if (currentUser.getRole() == UserRole.ADMIN) {
            return PagedResponse.of(mcqRepo.findByStatus(McqStatus.READY_FOR_REVIEW, pageable)
                    .map(McqMapper::toResponse));
        }
        return PagedResponse.of(mcqRepo.findByReviewerIdAndStatus(
                currentUser.getUserId(), McqStatus.READY_FOR_REVIEW, pageable)
                .map(McqMapper::toResponse));
    }

    // ── Auto-assign ───────────────────────────────────────────────────────────

    @Override
    @Transactional
    public int autoAssignReviewers() {
        List<McqQuestion> unassigned = mcqRepo.findUnassignedReadyForReview();
        int assigned = 0;

        for (McqQuestion question : unassigned) {
            Long stackId = question.getStack().getId();
            Long creatorId = question.getCreator().getId();

            // Find eligible SMEs: mapped to this stack, not the creator
            User reviewer = userRepo.findSmesByStackId(stackId).stream()
                    .filter(u -> !u.getId().equals(creatorId))
                    .min((a, b) -> Long.compare(
                            mcqRepo.countByReviewerIdAndStatus(a.getId(), McqStatus.UNDER_REVIEW),
                            mcqRepo.countByReviewerIdAndStatus(b.getId(), McqStatus.UNDER_REVIEW)))
                    .orElse(null);

            if (reviewer == null) continue;

            question.setReviewer(reviewer);
            question.setStatus(McqStatus.UNDER_REVIEW);
            mcqRepo.save(question);

            notificationService.push(reviewer.getId(),
                    NotificationType.REVIEW_ASSIGNED,
                    "Review Assignment",
                    "You have been auto-assigned to review question #" + question.getId()
                            + ": \"" + truncate(question.getQuestionStem(), 80) + "\"",
                    question.getId());
            assigned++;
        }

        log.info("Auto-assign: {} question(s) assigned", assigned);
        return assigned;
    }

    private McqQuestion findById(Long id) {
        return mcqRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("McqQuestion", id));
    }

    private String truncate(String text, int max) {
        if (text == null) return "";
        return text.length() > max ? text.substring(0, max) + "…" : text;
    }
}
