package com.accenture.smartquiz.controller;

import com.accenture.smartquiz.config.AiRateLimiter;
import com.accenture.smartquiz.dto.request.AiGenerateRequest;
import com.accenture.smartquiz.dto.request.DuplicateCheckRequest;
import com.accenture.smartquiz.dto.response.AiReviewResponse;
import com.accenture.smartquiz.dto.response.ApiResponse;
import com.accenture.smartquiz.dto.response.DuplicateCheckResponse;
import com.accenture.smartquiz.dto.response.McqResponse;
import com.accenture.smartquiz.security.SmartQuizUserDetails;
import com.accenture.smartquiz.service.AiQuestionService;
import com.accenture.smartquiz.service.AiReviewService;
import com.accenture.smartquiz.service.McqService;
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
 * Level 2 AI capabilities, available to both SMEs and Admins:
 * <ul>
 *   <li>Generate MCQs with AI (duplicates auto-screened during generation)</li>
 *   <li>On-demand duplicate / similarity check for the Edit page</li>
 * </ul>
 * Access is restricted to authenticated users by {@code SecurityConfig}.
 * Rate limit: {@value AiRateLimiter#MAX_CALLS} generate calls per user per hour.
 */
@RestController
@RequestMapping("/ai")
@RequiredArgsConstructor
@Tag(name = "AI", description = "AI-powered question generation and duplicate detection (SME & Admin)")
public class AiController {

    private final AiQuestionService aiQuestionService;
    private final AiReviewService aiReviewService;
    private final McqService mcqService;
    private final AiRateLimiter rateLimiter;

    @PostMapping("/generate")
    @Operation(summary = "Generate MCQs with AI (>=30% duplicates auto-replaced); saved as DRAFT")
    public ResponseEntity<ApiResponse<List<McqResponse>>> generate(
            @Valid @RequestBody AiGenerateRequest request,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        if (!rateLimiter.tryAcquire(currentUser.getUserId())) {
            int remaining = rateLimiter.remainingCalls(currentUser.getUserId());
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ApiResponse.error("AI generate rate limit exceeded (10 requests/hour). "
                            + "Remaining calls: " + remaining));
        }
        List<McqResponse> questions = aiQuestionService.generateQuestions(request, currentUser);
        return ResponseEntity.ok(ApiResponse.success(
                "Generated " + questions.size() + " question(s) as DRAFT. "
                        + "Remaining AI calls this hour: " + rateLimiter.remainingCalls(currentUser.getUserId()),
                questions));
    }

    @PostMapping("/duplicate-check")
    @Operation(summary = "Check a candidate MCQ for duplicates within the same stack & topic")
    public ResponseEntity<ApiResponse<DuplicateCheckResponse>> duplicateCheck(
            @Valid @RequestBody DuplicateCheckRequest request) {
        return ResponseEntity.ok(ApiResponse.success(mcqService.checkDuplicate(request)));
    }

    @PostMapping("/review/{questionId}")
    @Operation(summary = "AI Review Assistant — LLM quality analysis of an MCQ "
            + "(falls back to a heuristic analysis when the AI is unavailable)")
    public ResponseEntity<ApiResponse<AiReviewResponse>> review(
            @PathVariable Long questionId,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        if (!rateLimiter.tryAcquire(currentUser.getUserId())) {
            int remaining = rateLimiter.remainingCalls(currentUser.getUserId());
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ApiResponse.error("AI review rate limit exceeded (10 requests/hour). "
                            + "Remaining calls: " + remaining));
        }
        AiReviewResponse review = aiReviewService.analyze(questionId);
        return ResponseEntity.ok(ApiResponse.success(review));
    }
}
