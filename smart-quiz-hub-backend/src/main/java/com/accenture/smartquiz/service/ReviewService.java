package com.accenture.smartquiz.service;

import com.accenture.smartquiz.dto.request.AssignReviewerRequest;
import com.accenture.smartquiz.dto.request.BulkAssignRequest;
import com.accenture.smartquiz.dto.request.BulkDecisionRequest;
import com.accenture.smartquiz.dto.request.ReviewRequest;
import com.accenture.smartquiz.dto.response.BulkAssignResponse;
import com.accenture.smartquiz.dto.response.BulkDecisionResponse;
import com.accenture.smartquiz.dto.response.McqResponse;
import com.accenture.smartquiz.dto.response.PagedResponse;
import com.accenture.smartquiz.entity.enums.McqStatus;
import com.accenture.smartquiz.security.SmartQuizUserDetails;
import org.springframework.data.domain.Pageable;

public interface ReviewService {

    McqResponse assignReviewer(Long questionId, AssignReviewerRequest request, SmartQuizUserDetails currentUser);

    BulkAssignResponse bulkAssignReviewer(BulkAssignRequest request, SmartQuizUserDetails currentUser);

    McqResponse startReview(Long questionId, SmartQuizUserDetails currentUser);

    McqResponse submitReview(Long questionId, ReviewRequest request, SmartQuizUserDetails currentUser);

    /** Admin-only: apply the same review decision to many questions, skipping per-item failures. */
    BulkDecisionResponse bulkDecision(BulkDecisionRequest request, SmartQuizUserDetails currentUser);

    PagedResponse<McqResponse> getPendingReviews(SmartQuizUserDetails currentUser, Pageable pageable);

    PagedResponse<McqResponse> getReadyForReview(SmartQuizUserDetails currentUser, Pageable pageable);

    /** Questions the current user has already decided (approved / rejected / sent back). */
    PagedResponse<McqResponse> getReviewedByMe(SmartQuizUserDetails currentUser, Pageable pageable);

    /** Auto-assign READY_FOR_REVIEW questions with no reviewer to the least-loaded eligible SME. */
    int autoAssignReviewers();
}
