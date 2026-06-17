package com.accenture.smartquiz.controller;

import com.accenture.smartquiz.dto.request.CommentRequest;
import com.accenture.smartquiz.dto.response.ApiResponse;
import com.accenture.smartquiz.dto.response.CommentResponse;
import com.accenture.smartquiz.security.SmartQuizUserDetails;
import com.accenture.smartquiz.service.CommentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Review discussion thread for a question. Both endpoints are authenticated; the
 * {@link CommentService} enforces the same per-question visibility rule as the MCQ
 * service (creator, assigned reviewer, or admin only).
 */
@RestController
@RequestMapping("/questions/{questionId}/comments")
@RequiredArgsConstructor
@Tag(name = "Question Comments", description = "Review discussion thread on a question")
public class CommentController {

    private final CommentService commentService;

    @GetMapping
    @Operation(summary = "Get the discussion thread for a question (oldest first)")
    public ResponseEntity<ApiResponse<List<CommentResponse>>> getComments(
            @PathVariable Long questionId,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(
                commentService.getComments(questionId, currentUser)));
    }

    @PostMapping
    @Operation(summary = "Add a comment to a question's discussion thread")
    public ResponseEntity<ApiResponse<CommentResponse>> addComment(
            @PathVariable Long questionId,
            @Valid @RequestBody CommentRequest request,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Comment added",
                        commentService.addComment(questionId, request, currentUser)));
    }
}
