package com.accenture.smartquiz.controller;

import com.accenture.smartquiz.dto.response.ApiResponse;
import com.accenture.smartquiz.dto.response.AuditLogResponse;
import com.accenture.smartquiz.dto.response.PagedResponse;
import com.accenture.smartquiz.service.AuditService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/audit")
@RequiredArgsConstructor
@Tag(name = "Audit Trail", description = "Who changed what, when — MCQ lifecycle history")
public class AuditController {

    private final AuditService auditService;

    @GetMapping("/question/{questionId}")
    @Operation(summary = "Audit history for one question (paged, newest first). "
            + "Read-only history — available to any authenticated user.")
    public ResponseEntity<ApiResponse<PagedResponse<AuditLogResponse>>> getForQuestion(
            @PathVariable Long questionId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(ApiResponse.success(
                auditService.getForQuestion(questionId, pageable)));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Global audit trail across all questions (paged, newest first, Admin only)")
    public ResponseEntity<ApiResponse<PagedResponse<AuditLogResponse>>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(ApiResponse.success(auditService.getAll(pageable)));
    }
}
