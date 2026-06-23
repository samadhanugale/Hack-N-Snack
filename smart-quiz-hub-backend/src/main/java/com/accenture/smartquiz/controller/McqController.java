package com.accenture.smartquiz.controller;

import com.accenture.smartquiz.dto.request.McqRequest;
import com.accenture.smartquiz.dto.response.*;
import com.accenture.smartquiz.entity.enums.Difficulty;
import com.accenture.smartquiz.entity.enums.McqStatus;
import com.accenture.smartquiz.security.SmartQuizUserDetails;
import com.accenture.smartquiz.service.McqService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/questions")
@RequiredArgsConstructor
@Tag(name = "MCQ Questions", description = "Create, edit, and manage MCQ questions")
public class McqController {

    private final McqService mcqService;

    @PostMapping
    @Operation(summary = "Create a new MCQ question (saved as DRAFT)")
    public ResponseEntity<ApiResponse<McqResponse>> create(
            @Valid @RequestBody McqRequest request,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Question created successfully", mcqService.createQuestion(request, currentUser)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("@securityService.isOwner(#id, principal)")
    @Operation(summary = "Update an existing MCQ question (creator or admin only)")
    public ResponseEntity<ApiResponse<McqResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody McqRequest request,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success("Question updated successfully",
                mcqService.updateQuestion(id, request, currentUser)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a single MCQ question by ID")
    public ResponseEntity<ApiResponse<McqResponse>> getOne(
            @PathVariable Long id,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(mcqService.getQuestion(id, currentUser)));
    }

    @GetMapping("/my")
    @Operation(summary = "Get questions created by the current user")
    public ResponseEntity<ApiResponse<PagedResponse<McqResponse>>> getMyQuestions(
            @RequestParam(required = false) McqStatus status,
            @RequestParam(required = false) Long stackId,
            @RequestParam(required = false) Difficulty difficulty,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "updatedAt") String sort,
            @RequestParam(defaultValue = "desc") String direction,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        var pageable = PageRequest.of(page, size, resolveSort(sort, direction));
        return ResponseEntity.ok(ApiResponse.success(
                mcqService.getMyQuestions(status, stackId, difficulty, search, currentUser, pageable)));
    }

    @GetMapping
    @Operation(summary = "Get all questions (admin: all, SME: own + assigned)")
    public ResponseEntity<ApiResponse<PagedResponse<McqResponse>>> getAll(
            @RequestParam(required = false) McqStatus status,
            @RequestParam(required = false) Long stackId,
            @RequestParam(required = false) Difficulty difficulty,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "updatedAt") String sort,
            @RequestParam(defaultValue = "desc") String direction,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        var pageable = PageRequest.of(page, size, resolveSort(sort, direction));
        return ResponseEntity.ok(ApiResponse.success(
                mcqService.getAllQuestions(status, stackId, difficulty, search, currentUser, pageable)));
    }

    /**
     * Builds a safe {@link Sort} from the {@code sort}/{@code direction} request params.
     * Only a whitelist of entity fields is accepted (updatedAt, createdAt, difficulty,
     * status); anything else falls back to {@code updatedAt} so callers can never sort
     * by an arbitrary/unknown column.
     */
    private Sort resolveSort(String sort, String direction) {
        String field = switch (sort == null ? "" : sort) {
            case "createdAt", "difficulty", "status", "updatedAt" -> sort;
            default -> "updatedAt";
        };
        Sort.Direction dir = "asc".equalsIgnoreCase(direction) ? Sort.Direction.ASC : Sort.Direction.DESC;
        return Sort.by(dir, field);
    }

    @PostMapping("/{id}/submit")
    @Operation(summary = "Submit a DRAFT question for review")
    public ResponseEntity<ApiResponse<McqResponse>> submit(
            @PathVariable Long id,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success("Question submitted for review",
                mcqService.submitForReview(id, currentUser)));
    }

    @PostMapping("/{id}/accept")
    @PreAuthorize("@securityService.isCreator(#id, principal)")
    @Operation(summary = "Accept an AI-generated question (AI_PENDING → DRAFT)")
    public ResponseEntity<ApiResponse<McqResponse>> acceptAi(
            @PathVariable Long id,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success("AI question accepted",
                mcqService.acceptAiQuestion(id, currentUser)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@securityService.isCreator(#id, principal)")
    @Operation(summary = "Delete a question (creator only — admins cannot delete)")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        mcqService.deleteQuestion(id, currentUser);
        return ResponseEntity.ok(ApiResponse.success("Question deleted successfully"));
    }

    @GetMapping("/dashboard/stats")
    @Operation(summary = "Get dashboard statistics for current user")
    public ResponseEntity<ApiResponse<DashboardStatsResponse>> getStats(
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(mcqService.getDashboardStats(currentUser)));
    }

    @GetMapping("/search")
    @Operation(summary = "Full-text search across question stem and options (PostgreSQL FTS)")
    public ResponseEntity<ApiResponse<List<McqResponse>>> search(
            @RequestParam String q,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(mcqService.searchQuestions(q, currentUser)));
    }

    @GetMapping("/export")
    @Operation(summary = "Export questions to XLSX (admin: all statuses, default APPROVED)")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) Long stackId,
            @RequestParam(required = false) Long topicId,
            @RequestParam(required = false) Difficulty difficulty,
            @RequestParam(required = false, defaultValue = "APPROVED") McqStatus status) {
        byte[] xlsx = mcqService.exportToXlsx(stackId, topicId, difficulty, status);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"questions.xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(xlsx);
    }

    @GetMapping("/import-template")
    @Operation(summary = "Download the XLSX template for bulk import (same layout as export)")
    public ResponseEntity<byte[]> importTemplate() {
        byte[] xlsx = mcqService.importTemplate();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"question-import-template.xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(xlsx);
    }

    @PostMapping(value = "/bulk-upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Bulk upload MCQ questions from XLSX file")
    public ResponseEntity<ApiResponse<BulkUploadResponse>> bulkUpload(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        String originalFilename = file.getOriginalFilename();
        String contentType = file.getContentType();
        boolean validExtension = originalFilename != null && originalFilename.toLowerCase().endsWith(".xlsx");
        boolean validMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".equals(contentType)
                || "application/octet-stream".equals(contentType);
        if (!validExtension || !validMime) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Only .xlsx files are accepted"));
        }
        BulkUploadResponse response = mcqService.bulkUpload(file, currentUser);
        return ResponseEntity.ok(ApiResponse.success("Bulk upload processed", response));
    }
}
