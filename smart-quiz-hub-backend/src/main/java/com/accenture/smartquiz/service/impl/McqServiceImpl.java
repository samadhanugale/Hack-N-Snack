package com.accenture.smartquiz.service.impl;

import com.accenture.smartquiz.dto.request.DuplicateCheckRequest;
import com.accenture.smartquiz.dto.request.McqRequest;
import com.accenture.smartquiz.dto.response.BulkUploadResponse;
import com.accenture.smartquiz.dto.response.DashboardStatsResponse;
import com.accenture.smartquiz.dto.response.DuplicateCheckResponse;
import com.accenture.smartquiz.dto.response.McqResponse;
import com.accenture.smartquiz.dto.response.PagedResponse;
import com.accenture.smartquiz.dto.response.SimilarQuestionResponse;
import com.accenture.smartquiz.entity.McqQuestion;
import com.accenture.smartquiz.entity.TechnologyStack;
import com.accenture.smartquiz.entity.Topic;
import com.accenture.smartquiz.entity.User;
import com.accenture.smartquiz.entity.enums.Difficulty;
import com.accenture.smartquiz.entity.enums.McqStatus;
import com.accenture.smartquiz.entity.enums.UserRole;
import com.accenture.smartquiz.exception.DuplicateQuestionException;
import com.accenture.smartquiz.exception.InvalidStatusTransitionException;
import com.accenture.smartquiz.exception.ResourceNotFoundException;
import com.accenture.smartquiz.exception.UnauthorizedAccessException;
import com.accenture.smartquiz.repository.McqQuestionRepository;
import com.accenture.smartquiz.repository.TechnologyStackRepository;
import com.accenture.smartquiz.repository.TopicRepository;
import com.accenture.smartquiz.repository.UserRepository;
import com.accenture.smartquiz.security.SmartQuizUserDetails;
import com.accenture.smartquiz.service.McqService;
import com.accenture.smartquiz.service.SimilarityOutcome;
import com.accenture.smartquiz.service.SimilarityService;
import com.accenture.smartquiz.util.McqMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class McqServiceImpl implements McqService {

    private final McqQuestionRepository mcqRepo;
    private final TechnologyStackRepository stackRepo;
    private final TopicRepository topicRepo;
    private final UserRepository userRepo;
    private final SimilarityService similarityService;

    @Override
    @Transactional
    public McqResponse createQuestion(McqRequest req, SmartQuizUserDetails currentUser) {
        TechnologyStack stack = stackRepo.findById(req.getStackId())
                .orElseThrow(() -> new ResourceNotFoundException("TechnologyStack", req.getStackId()));
        Topic topic = topicRepo.findById(req.getTopicId())
                .orElseThrow(() -> new ResourceNotFoundException("Topic", req.getTopicId()));
        User creator = userRepo.getReferenceById(currentUser.getUserId());

        McqQuestion question = McqQuestion.builder()
                .questionStem(req.getQuestionStem())
                .optionA(req.getOptionA())
                .optionB(req.getOptionB())
                .optionC(req.getOptionC())
                .optionD(req.getOptionD())
                .correctOption(req.getCorrectOption().toUpperCase())
                .difficulty(req.getDifficulty())
                .stack(stack)
                .topic(topic)
                .creator(creator)
                .status(McqStatus.DRAFT)
                .build();

        return McqMapper.toResponse(mcqRepo.save(question));
    }

    @Override
    @Transactional
    public McqResponse updateQuestion(Long id, McqRequest req, SmartQuizUserDetails currentUser) {
        McqQuestion question = findQuestionById(id);
        assertCanEdit(question, currentUser);

        TechnologyStack stack = stackRepo.findById(req.getStackId())
                .orElseThrow(() -> new ResourceNotFoundException("TechnologyStack", req.getStackId()));
        Topic topic = topicRepo.findById(req.getTopicId())
                .orElseThrow(() -> new ResourceNotFoundException("Topic", req.getTopicId()));

        question.setQuestionStem(req.getQuestionStem());
        question.setOptionA(req.getOptionA());
        question.setOptionB(req.getOptionB());
        question.setOptionC(req.getOptionC());
        question.setOptionD(req.getOptionD());
        question.setCorrectOption(req.getCorrectOption().toUpperCase());
        question.setDifficulty(req.getDifficulty());
        question.setStack(stack);
        question.setTopic(topic);

        return McqMapper.toResponse(mcqRepo.save(question));
    }

    @Override
    @Transactional(readOnly = true)
    public McqResponse getQuestion(Long id, SmartQuizUserDetails currentUser) {
        McqQuestion question = findQuestionById(id);
        assertCanView(question, currentUser);
        return McqMapper.toResponse(question);
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<McqResponse> getMyQuestions(McqStatus status, SmartQuizUserDetails currentUser, Pageable pageable) {
        Page<McqQuestion> page = status != null
                ? mcqRepo.findByCreatorIdAndStatus(currentUser.getUserId(), status, pageable)
                : mcqRepo.findByCreatorId(currentUser.getUserId(), pageable);
        return PagedResponse.of(page.map(McqMapper::toResponse));
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<McqResponse> getAllQuestions(McqStatus status, Long stackId, Difficulty difficulty,
                                                       SmartQuizUserDetails currentUser, Pageable pageable) {
        Specification<McqQuestion> spec = buildSpec(status, stackId, difficulty, currentUser);
        Page<McqQuestion> page = mcqRepo.findAll(spec, pageable);
        return PagedResponse.of(page.map(McqMapper::toResponse));
    }

    @Override
    @Transactional
    public McqResponse submitForReview(Long id, SmartQuizUserDetails currentUser) {
        McqQuestion question = findQuestionById(id);

        if (!question.getCreator().getId().equals(currentUser.getUserId())) {
            throw new UnauthorizedAccessException("Only the creator can submit a question for review");
        }
        if (!question.getStatus().canTransitionTo(McqStatus.READY_FOR_REVIEW)) {
            throw new InvalidStatusTransitionException(question.getStatus(), McqStatus.READY_FOR_REVIEW);
        }

        // Level 2: a question may only be sent for review if it is below the
        // similarity threshold. The same check also backs the "Duplicate Check"
        // button on the Edit page.
        enforceNotDuplicate(question);

        question.setStatus(McqStatus.READY_FOR_REVIEW);
        return McqMapper.toResponse(mcqRepo.save(question));
    }

    /**
     * Runs the similarity engine for a persisted question (excluding itself).
     * Persists the resulting score and throws {@link DuplicateQuestionException}
     * with the offending matches when the threshold is reached.
     */
    private void enforceNotDuplicate(McqQuestion question) {
        SimilarityOutcome outcome = similarityService.analyze(
                question.getStack().getId(), question.getTopic().getId(),
                question.getQuestionStem(), question.getOptionA(), question.getOptionB(),
                question.getOptionC(), question.getOptionD(), question.getId());

        double threshold = similarityService.threshold();
        question.setAiSimilarityScore(
                BigDecimal.valueOf(outcome.maxScore()).setScale(4, RoundingMode.HALF_UP));

        if (outcome.maxScore() < threshold) {
            return;
        }

        int thresholdPercent = (int) Math.round(threshold * 100);
        double maxPercent = McqMapper.toPercent(outcome.maxScore());

        List<SimilarQuestionResponse> similar = outcome.matchesAtOrAbove(threshold).stream()
                .map(m -> McqMapper.toSimilarResponse(m.question(), m.score()))
                .toList();

        String topMatch = similar.isEmpty() ? "" :
                " Most similar: \"" + truncate(similar.get(0).getQuestionStem(), 80) + "\".";

        String message = String.format(
                "This question is %.1f%% similar to an existing question (threshold %d%%). "
                        + "Please revise it and re-run the duplicate check before sending for review.%s",
                maxPercent, thresholdPercent, topMatch);

        throw new DuplicateQuestionException(message, maxPercent, thresholdPercent, similar);
    }

    private String truncate(String text, int max) {
        if (text == null) {
            return "";
        }
        return text.length() > max ? text.substring(0, max) + "..." : text;
    }

    @Override
    @Transactional
    public void deleteQuestion(Long id, SmartQuizUserDetails currentUser) {
        McqQuestion question = findQuestionById(id);

        boolean isCreator = question.getCreator().getId().equals(currentUser.getUserId());
        boolean isAdmin = currentUser.getRole() == UserRole.ADMIN;

        boolean creatorDeletable = isCreator &&
                (question.getStatus() == McqStatus.DRAFT ||
                 question.getStatus() == McqStatus.READY_FOR_REVIEW);

        if (!creatorDeletable && !isAdmin) {
            throw new UnauthorizedAccessException(
                "You can only delete your own questions in DRAFT or READY FOR REVIEW status");
        }

        mcqRepo.delete(question);
    }

    @Override
    @Transactional(readOnly = true)
    public DashboardStatsResponse getDashboardStats(SmartQuizUserDetails currentUser) {
        if (currentUser.getRole() == UserRole.ADMIN) {
            return DashboardStatsResponse.builder()
                    .totalQuestions(mcqRepo.count())
                    .draftCount(mcqRepo.countByStatus(McqStatus.DRAFT))
                    .readyForReviewCount(mcqRepo.countByStatus(McqStatus.READY_FOR_REVIEW))
                    .underReviewCount(mcqRepo.countByStatus(McqStatus.UNDER_REVIEW))
                    .approvedCount(mcqRepo.countByStatus(McqStatus.APPROVED))
                    .rejectedCount(mcqRepo.countByStatus(McqStatus.REJECTED))
                    .build();
        }

        Long uid = currentUser.getUserId();
        return DashboardStatsResponse.builder()
                .totalQuestions(mcqRepo.countByCreatorId(uid))
                .draftCount(mcqRepo.countByCreatorIdAndStatus(uid, McqStatus.DRAFT))
                .readyForReviewCount(mcqRepo.countByCreatorIdAndStatus(uid, McqStatus.READY_FOR_REVIEW))
                .underReviewCount(mcqRepo.countByCreatorIdAndStatus(uid, McqStatus.UNDER_REVIEW))
                .approvedCount(mcqRepo.countByCreatorIdAndStatus(uid, McqStatus.APPROVED))
                .rejectedCount(mcqRepo.countByCreatorIdAndStatus(uid, McqStatus.REJECTED))
                .pendingReviewCount(mcqRepo.countByReviewerIdAndStatus(uid, McqStatus.UNDER_REVIEW))
                .build();
    }

    @Override
    @Transactional
    public BulkUploadResponse bulkUpload(MultipartFile file, SmartQuizUserDetails currentUser) {
        List<String> errors = new ArrayList<>();
        int success = 0;
        int rowNum = 1;

        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);

            for (Row row : sheet) {
                if (row.getRowNum() == 0) continue; // skip header
                rowNum = row.getRowNum() + 1;

                try {
                    McqQuestion question = parseRow(row, currentUser);
                    mcqRepo.save(question);
                    success++;
                } catch (Exception e) {
                    errors.add("Row " + rowNum + ": " + e.getMessage());
                    log.warn("Bulk upload row {} failed: {}", rowNum, e.getMessage());
                }
            }
        } catch (IOException e) {
            log.error("Failed to parse bulk upload file", e);
            errors.add("Failed to read file: " + e.getMessage());
        }

        return BulkUploadResponse.builder()
                .totalRows(rowNum - 1)
                .successCount(success)
                .failureCount(errors.size())
                .errors(errors)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public DuplicateCheckResponse checkDuplicate(DuplicateCheckRequest req) {
        SimilarityOutcome outcome = similarityService.analyze(
                req.getStackId(), req.getTopicId(),
                req.getQuestionStem(), req.getOptionA(), req.getOptionB(),
                req.getOptionC(), req.getOptionD(), req.getExcludeId());

        double threshold = similarityService.threshold();
        boolean duplicate = outcome.maxScore() >= threshold;

        List<SimilarQuestionResponse> similar = outcome.matchesAtOrAbove(threshold).stream()
                .map(m -> McqMapper.toSimilarResponse(m.question(), m.score()))
                .toList();

        return DuplicateCheckResponse.builder()
                .duplicate(duplicate)
                .maxSimilarityPercent(McqMapper.toPercent(outcome.maxScore()))
                .thresholdPercent((int) Math.round(threshold * 100))
                .similar(similar)
                .build();
    }

    private McqQuestion parseRow(Row row, SmartQuizUserDetails currentUser) {
        String questionStem = getCellString(row, 0);
        String optionA = getCellString(row, 1);
        String optionB = getCellString(row, 2);
        String optionC = getCellString(row, 3);
        String optionD = getCellString(row, 4);
        String correctOption = getCellString(row, 5).toUpperCase();
        String difficultyStr = getCellString(row, 6).toUpperCase();
        String stackName = getCellString(row, 7);
        String topicName = getCellString(row, 8);

        if (questionStem.isBlank()) throw new IllegalArgumentException("Question stem is empty");
        if (mcqRepo.existsByQuestionStemIgnoreCase(questionStem))
            throw new IllegalArgumentException("Duplicate question — already exists in the question bank");
        if (!correctOption.matches("[ABCD]")) throw new IllegalArgumentException("Correct option must be A/B/C/D");

        Difficulty difficulty;
        try {
            difficulty = Difficulty.valueOf(difficultyStr);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid difficulty: " + difficultyStr);
        }

        TechnologyStack stack = stackRepo.findAll().stream()
                .filter(s -> s.getStackName().equalsIgnoreCase(stackName))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown stack: " + stackName));

        Topic topic = topicRepo.findByStackIdAndTopicNameIgnoreCase(stack.getId(), topicName)
                .orElseThrow(() -> new IllegalArgumentException("Unknown topic: " + topicName));

        return McqQuestion.builder()
                .questionStem(questionStem)
                .optionA(optionA)
                .optionB(optionB)
                .optionC(optionC)
                .optionD(optionD)
                .correctOption(correctOption)
                .difficulty(difficulty)
                .stack(stack)
                .topic(topic)
                .creator(userRepo.getReferenceById(currentUser.getUserId()))
                .status(McqStatus.DRAFT)
                .build();
    }

    private String getCellString(Row row, int col) {
        Cell cell = row.getCell(col, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> String.valueOf((long) cell.getNumericCellValue());
            default -> "";
        };
    }

    private McqQuestion findQuestionById(Long id) {
        return mcqRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("McqQuestion", id));
    }

    private void assertCanEdit(McqQuestion question, SmartQuizUserDetails currentUser) {
        boolean isCreator = question.getCreator().getId().equals(currentUser.getUserId());
        boolean isAdmin = currentUser.getRole() == UserRole.ADMIN;

        boolean creatorEditable = isCreator &&
                (question.getStatus() == McqStatus.DRAFT ||
                 question.getStatus() == McqStatus.READY_FOR_REVIEW ||
                 question.getStatus() == McqStatus.REJECTED);

        if (!creatorEditable && !isAdmin) {
            throw new UnauthorizedAccessException(
                "You can only edit your own questions that are in DRAFT, READY FOR REVIEW, or REJECTED status");
        }
    }

    private void assertCanView(McqQuestion question, SmartQuizUserDetails currentUser) {
        boolean isCreator = question.getCreator().getId().equals(currentUser.getUserId());
        boolean isAdmin = currentUser.getRole() == UserRole.ADMIN;
        boolean isReviewer = question.getReviewer() != null &&
                             question.getReviewer().getId().equals(currentUser.getUserId());

        if (!isCreator && !isAdmin && !isReviewer) {
            throw new UnauthorizedAccessException("You don't have access to this question");
        }
    }

    private Specification<McqQuestion> buildSpec(McqStatus status, Long stackId, Difficulty difficulty,
                                                   SmartQuizUserDetails currentUser) {
        return (root, query, cb) -> {
            var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();

            if (currentUser.getRole() != UserRole.ADMIN) {
                predicates.add(cb.or(
                        cb.equal(root.get("creator").get("id"), currentUser.getUserId()),
                        cb.equal(root.get("reviewer").get("id"), currentUser.getUserId())
                ));
            }
            if (status != null) predicates.add(cb.equal(root.get("status"), status));
            if (stackId != null) predicates.add(cb.equal(root.get("stack").get("id"), stackId));
            if (difficulty != null) predicates.add(cb.equal(root.get("difficulty"), difficulty));

            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }
}
