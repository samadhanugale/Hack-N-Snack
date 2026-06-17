package com.accenture.smartquiz.controller;

import com.accenture.smartquiz.dto.request.AssignReviewerRequest;
import com.accenture.smartquiz.dto.request.BulkAssignRequest;
import com.accenture.smartquiz.dto.request.BulkDecisionRequest;
import com.accenture.smartquiz.dto.request.ReviewRequest;
import com.accenture.smartquiz.dto.response.ApiResponse;
import com.accenture.smartquiz.dto.response.BulkAssignResponse;
import com.accenture.smartquiz.dto.response.BulkDecisionResponse;
import com.accenture.smartquiz.dto.response.McqResponse;
import com.accenture.smartquiz.dto.response.PagedResponse;
import com.accenture.smartquiz.security.SmartQuizUserDetails;
import com.accenture.smartquiz.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/reviews")
@RequiredArgsConstructor
@Tag(name = "Review", description = "MCQ review workflow")
public class ReviewController {

    private final ReviewService reviewService;

    @PostMapping("/questions/bulk-assign")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Bulk-assign a reviewer to multiple READY_FOR_REVIEW questions (Admin only)")
    public ResponseEntity<ApiResponse<BulkAssignResponse>> bulkAssignReviewer(
            @Valid @RequestBody BulkAssignRequest request,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success("Bulk assign completed",
                reviewService.bulkAssignReviewer(request, currentUser)));
    }

    @PostMapping("/questions/bulk-decision")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Bulk-apply a review decision to multiple UNDER_REVIEW questions (Admin only)")
    public ResponseEntity<ApiResponse<BulkDecisionResponse>> bulkDecision(
            @Valid @RequestBody BulkDecisionRequest request,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success("Bulk decision completed",
                reviewService.bulkDecision(request, currentUser)));
    }

    @PostMapping("/questions/{questionId}/assign")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Assign a reviewer to a question (Admin only)")
    public ResponseEntity<ApiResponse<McqResponse>> assignReviewer(
            @PathVariable Long questionId,
            @Valid @RequestBody AssignReviewerRequest request,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success("Reviewer assigned successfully",
                reviewService.assignReviewer(questionId, request, currentUser)));
    }

    @PostMapping("/questions/{questionId}/decision")
    @Operation(summary = "Submit review decision (APPROVED or REJECTED)")
    public ResponseEntity<ApiResponse<McqResponse>> submitReview(
            @PathVariable Long questionId,
            @Valid @RequestBody ReviewRequest request,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success("Review submitted",
                reviewService.submitReview(questionId, request, currentUser)));
    }

    @GetMapping("/pending")
    @Operation(summary = "Get questions assigned to current user for review")
    public ResponseEntity<ApiResponse<PagedResponse<McqResponse>>> getPending(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        var pageable = PageRequest.of(page, size, Sort.by("updatedAt").descending());
        return ResponseEntity.ok(ApiResponse.success(reviewService.getPendingReviews(currentUser, pageable)));
    }

    @GetMapping("/reviewed")
    @Operation(summary = "Get questions the current user has already reviewed (decided)")
    public ResponseEntity<ApiResponse<PagedResponse<McqResponse>>> getReviewed(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        var pageable = PageRequest.of(page, size, Sort.by("reviewedAt").descending());
        return ResponseEntity.ok(ApiResponse.success(reviewService.getReviewedByMe(currentUser, pageable)));
    }

    @PostMapping("/auto-assign")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Auto-assign unreviewed questions to the least-loaded eligible SME (Admin only)")
    public ResponseEntity<ApiResponse<String>> autoAssign(
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        int count = reviewService.autoAssignReviewers();
        return ResponseEntity.ok(ApiResponse.success(
                count + " question(s) auto-assigned", null));
    }

    @GetMapping("/ready")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get all questions in READY_FOR_REVIEW status (Admin only)")
    public ResponseEntity<ApiResponse<PagedResponse<McqResponse>>> getReadyForReview(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        var pageable = PageRequest.of(page, size, Sort.by("updatedAt").descending());
        return ResponseEntity.ok(ApiResponse.success(reviewService.getReadyForReview(currentUser, pageable)));
    }
}
