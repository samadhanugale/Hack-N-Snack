package com.accenture.smartquiz.service;

import com.accenture.smartquiz.dto.request.DuplicateCheckRequest;
import com.accenture.smartquiz.dto.request.McqRequest;
import com.accenture.smartquiz.dto.response.BulkUploadResponse;
import com.accenture.smartquiz.dto.response.DashboardStatsResponse;
import com.accenture.smartquiz.dto.response.DuplicateCheckResponse;
import com.accenture.smartquiz.dto.response.McqResponse;
import com.accenture.smartquiz.dto.response.PagedResponse;
import com.accenture.smartquiz.entity.enums.Difficulty;
import com.accenture.smartquiz.entity.enums.McqStatus;
import com.accenture.smartquiz.security.SmartQuizUserDetails;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface McqService {

    McqResponse createQuestion(McqRequest request, SmartQuizUserDetails currentUser);

    McqResponse updateQuestion(Long id, McqRequest request, SmartQuizUserDetails currentUser);

    McqResponse getQuestion(Long id, SmartQuizUserDetails currentUser);

    PagedResponse<McqResponse> getMyQuestions(McqStatus status, Long stackId, Difficulty difficulty,
                                               String search, SmartQuizUserDetails currentUser, Pageable pageable);

    PagedResponse<McqResponse> getAllQuestions(McqStatus status, Long stackId, Difficulty difficulty,
                                                String search, SmartQuizUserDetails currentUser, Pageable pageable);

    McqResponse submitForReview(Long id, SmartQuizUserDetails currentUser);

    /** Creator accepts an AI-generated question (AI_PENDING → DRAFT), moving it into their drafts. */
    McqResponse acceptAiQuestion(Long id, SmartQuizUserDetails currentUser);

    void deleteQuestion(Long id, SmartQuizUserDetails currentUser);

    DashboardStatsResponse getDashboardStats(SmartQuizUserDetails currentUser);

    BulkUploadResponse bulkUpload(MultipartFile file, SmartQuizUserDetails currentUser);

    /** AI-driven similarity check for a candidate MCQ (Edit page, Level 2). */
    DuplicateCheckResponse checkDuplicate(DuplicateCheckRequest request);

    /** Full-text search across question stem and options using PostgreSQL FTS. */
    List<McqResponse> searchQuestions(String query, SmartQuizUserDetails currentUser);

    /** Export filtered questions as an XLSX byte array (same layout the importer accepts). */
    byte[] exportToXlsx(Long stackId, Long topicId, Difficulty difficulty, McqStatus status);

    /** A blank XLSX template (headers + examples) matching the bulk-import format. */
    byte[] importTemplate();
}
