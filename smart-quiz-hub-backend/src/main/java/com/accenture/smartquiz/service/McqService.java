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

public interface McqService {

    McqResponse createQuestion(McqRequest request, SmartQuizUserDetails currentUser);

    McqResponse updateQuestion(Long id, McqRequest request, SmartQuizUserDetails currentUser);

    McqResponse getQuestion(Long id, SmartQuizUserDetails currentUser);

    PagedResponse<McqResponse> getMyQuestions(McqStatus status, SmartQuizUserDetails currentUser, Pageable pageable);

    PagedResponse<McqResponse> getAllQuestions(McqStatus status, Long stackId, Difficulty difficulty,
                                                SmartQuizUserDetails currentUser, Pageable pageable);

    McqResponse submitForReview(Long id, SmartQuizUserDetails currentUser);

    void deleteQuestion(Long id, SmartQuizUserDetails currentUser);

    DashboardStatsResponse getDashboardStats(SmartQuizUserDetails currentUser);

    BulkUploadResponse bulkUpload(MultipartFile file, SmartQuizUserDetails currentUser);

    /** AI-driven similarity check for a candidate MCQ (Edit page, Level 2). */
    DuplicateCheckResponse checkDuplicate(DuplicateCheckRequest request);
}
