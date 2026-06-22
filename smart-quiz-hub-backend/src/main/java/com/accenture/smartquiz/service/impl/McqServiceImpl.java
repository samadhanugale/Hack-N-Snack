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
import com.accenture.smartquiz.service.AuditService;
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
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class McqServiceImpl implements McqService {

    private final McqQuestionRepository mcqRepo;
    private final TechnologyStackRepository stackRepo;
    private final TopicRepository topicRepo;
    private final UserRepository userRepo;
    private final SimilarityService similarityService;
    private final AuditService auditService;

    @Override
    @Transactional
    public McqResponse createQuestion(McqRequest req, SmartQuizUserDetails currentUser) {
        TechnologyStack stack = stackRepo.findById(req.stackId())
                .orElseThrow(() -> new ResourceNotFoundException("TechnologyStack", req.stackId()));
        Topic topic = topicRepo.findById(req.topicId())
                .orElseThrow(() -> new ResourceNotFoundException("Topic", req.topicId()));
        User creator = userRepo.getReferenceById(currentUser.getUserId());

        McqQuestion question = McqQuestion.builder()
                .questionStem(req.questionStem())
                .options(req.options())
                .correctOptionIndices(req.correctOptionIndices())
                .difficulty(req.difficulty())
                .stack(stack)
                .topic(topic)
                .creator(creator)
                .status(McqStatus.DRAFT)
                .build();

        McqQuestion saved = mcqRepo.save(question);
        auditService.record(saved.getId(), "CREATED", currentUser.getUserId(),
                currentUser.getFullName(), "Question created (DRAFT)");
        return McqMapper.toResponse(saved);
    }

    @Override
    @Transactional
    public McqResponse updateQuestion(Long id, McqRequest req, SmartQuizUserDetails currentUser) {
        McqQuestion question = findQuestionById(id);
        assertCanEdit(question, currentUser);

        TechnologyStack stack = stackRepo.findById(req.stackId())
                .orElseThrow(() -> new ResourceNotFoundException("TechnologyStack", req.stackId()));
        Topic topic = topicRepo.findById(req.topicId())
                .orElseThrow(() -> new ResourceNotFoundException("Topic", req.topicId()));

        question.setQuestionStem(req.questionStem());
        question.setOptions(req.options());
        question.setCorrectOptionIndices(req.correctOptionIndices());
        question.setDifficulty(req.difficulty());
        question.setStack(stack);
        question.setTopic(topic);

        McqQuestion saved = mcqRepo.save(question);
        auditService.record(saved.getId(), "UPDATED", currentUser.getUserId(),
                currentUser.getFullName(), "Question content updated");
        return McqMapper.toResponse(saved);
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
    public PagedResponse<McqResponse> getMyQuestions(McqStatus status, Long stackId, Difficulty difficulty,
                                                      String search, SmartQuizUserDetails currentUser, Pageable pageable) {
        // Visibility: "my questions" are strictly the ones the current user authored.
        Specification<McqQuestion> spec = (root, query, cb) -> {
            var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.equal(root.get("creator").get("id"), currentUser.getUserId()));
            if (status != null) predicates.add(cb.equal(root.get("status"), status));
            if (stackId != null) predicates.add(cb.equal(root.get("stack").get("id"), stackId));
            if (difficulty != null) predicates.add(cb.equal(root.get("difficulty"), difficulty));
            addStemSearch(predicates, search, root, cb);
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
        Page<McqQuestion> page = mcqRepo.findAll(spec, pageable);
        return PagedResponse.of(page.map(McqMapper::toResponse));
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<McqResponse> getAllQuestions(McqStatus status, Long stackId, Difficulty difficulty,
                                                       String search, SmartQuizUserDetails currentUser, Pageable pageable) {
        Specification<McqQuestion> spec = buildSpec(status, stackId, difficulty, search, currentUser);
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
        question.setSubmittedAt(java.time.Instant.now());
        McqQuestion saved = mcqRepo.save(question);
        auditService.record(saved.getId(), "SUBMITTED", currentUser.getUserId(),
                currentUser.getFullName(), "status DRAFT → READY_FOR_REVIEW");
        return McqMapper.toResponse(saved);
    }

    /**
     * Runs the similarity engine for a persisted question (excluding itself).
     * Persists the resulting score and throws {@link DuplicateQuestionException}
     * with the offending matches when the threshold is reached.
     */
    private void enforceNotDuplicate(McqQuestion question) {
        SimilarityOutcome outcome = similarityService.analyze(
                question.getStack().getId(), question.getTopic().getId(),
                question.getQuestionStem(), question.getOptions(), question.getId());

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

        // Record with a null question_id: the audit_logs FK cascades on question delete, so a
        // DELETED entry keyed to this question would be removed with it. Keep the id in details.
        auditService.record(null, "DELETED", currentUser.getUserId(), currentUser.getFullName(),
                "Question #" + id + " deleted (was " + question.getStatus() + ")");
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
                    .modificationRequestedCount(mcqRepo.countByStatus(McqStatus.MODIFICATION_REQUESTED))
                    .approvedCount(mcqRepo.countByStatus(McqStatus.APPROVED))
                    .rejectedCount(mcqRepo.countByStatus(McqStatus.REJECTED))
                    .build();
        }

        Long uid = currentUser.getUserId();
        long approvedByMe = mcqRepo.countByReviewerIdAndStatus(uid, McqStatus.APPROVED);
        long rejectedByMe = mcqRepo.countByReviewerIdAndStatus(uid, McqStatus.REJECTED);
        long modRequestedByMe = mcqRepo.countByReviewerIdAndStatus(uid, McqStatus.MODIFICATION_REQUESTED);
        return DashboardStatsResponse.builder()
                .totalQuestions(mcqRepo.countByCreatorId(uid))
                .draftCount(mcqRepo.countByCreatorIdAndStatus(uid, McqStatus.DRAFT))
                .readyForReviewCount(mcqRepo.countByCreatorIdAndStatus(uid, McqStatus.READY_FOR_REVIEW))
                .underReviewCount(mcqRepo.countByCreatorIdAndStatus(uid, McqStatus.UNDER_REVIEW))
                .modificationRequestedCount(mcqRepo.countByCreatorIdAndStatus(uid, McqStatus.MODIFICATION_REQUESTED))
                .approvedCount(mcqRepo.countByCreatorIdAndStatus(uid, McqStatus.APPROVED))
                .rejectedCount(mcqRepo.countByCreatorIdAndStatus(uid, McqStatus.REJECTED))
                // Reviewer-role workload
                .pendingReviewCount(mcqRepo.countByReviewerIdAndStatus(uid, McqStatus.UNDER_REVIEW))
                .assignedToMeCount(mcqRepo.countByReviewerId(uid))
                .approvedByMeCount(approvedByMe)
                .rejectedByMeCount(rejectedByMe)
                .reviewedByMeCount(approvedByMe + rejectedByMe + modRequestedByMe)
                .build();
    }

    @Override
    @Transactional
    public BulkUploadResponse bulkUpload(MultipartFile file, SmartQuizUserDetails currentUser) {
        List<String> errors = new ArrayList<>();
        List<BulkUploadResponse.BulkRowDuplicate> duplicates = new ArrayList<>();
        int success = 0;
        int dataRows = 0;

        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                return failure("The sheet is empty — expected a header row. Download the template to see the format.");
            }

            // Header-driven parsing: resolve columns by name so the exported file is
            // re-importable and any extra metadata columns are simply ignored.
            Map<String, Integer> col = new HashMap<>();
            TreeMap<Integer, Integer> optionsByLetter = new TreeMap<>();
            for (Cell cell : headerRow) {
                String name = getCellString(headerRow, cell.getColumnIndex());
                if (name.isBlank()) continue;
                String lower = name.toLowerCase();
                if (lower.startsWith("option")) {
                    try {
                        optionsByLetter.put(letterToIndex(name.substring("option".length()).trim()), cell.getColumnIndex());
                    } catch (RuntimeException ignore) { /* not a lettered "Option X" header */ }
                } else {
                    col.put(lower, cell.getColumnIndex());
                }
            }
            List<Integer> optionCols = new ArrayList<>(optionsByLetter.values());

            List<String> missing = new ArrayList<>();
            for (String req : List.of("stack", "topic", "difficulty", "question", "correct answers")) {
                if (!col.containsKey(req)) missing.add(req);
            }
            if (optionCols.isEmpty()) missing.add("Option A/B/C…");
            if (!missing.isEmpty()) {
                return failure("Invalid format. Missing column(s): " + String.join(", ", missing)
                        + ". Download the template to see the expected layout.");
            }

            for (Row row : sheet) {
                if (row.getRowNum() == 0) continue;
                if (isBlankRow(row, col, optionCols)) continue;
                dataRows++;
                try {
                    mcqRepo.save(parseRow(row, col, optionCols, currentUser));
                    success++;
                } catch (DuplicateQuestionException dup) {
                    int rowNum = row.getRowNum() + 1;
                    Integer stemCol = col.containsKey("question") ? col.get("question") : null;
                    String stem = stemCol != null ? getCellString(row, stemCol) : "";
                    if (!dup.getSimilar().isEmpty()) {
                        SimilarQuestionResponse top = dup.getSimilar().get(0);
                        duplicates.add(BulkUploadResponse.BulkRowDuplicate.builder()
                                .rowNumber(rowNum)
                                .questionStem(stem)
                                .similarityPercent(dup.getMaxSimilarityPercent())
                                .matchedId(top.getId())
                                .matchedStem(top.getQuestionStem())
                                .matchedStatus(top.getStatus() != null ? top.getStatus().name() : null)
                                .build());
                    } else {
                        // No structured match available — fall back to plain error
                        errors.add("Row " + rowNum + " (duplicate): " + dup.getMessage());
                    }
                    log.warn("Bulk upload row {} duplicate: {}", rowNum, dup.getMessage());
                } catch (Exception e) {
                    errors.add("Row " + (row.getRowNum() + 1) + ": " + e.getMessage());
                    log.warn("Bulk upload row {} failed: {}", row.getRowNum() + 1, e.getMessage());
                }
            }
        } catch (IOException e) {
            log.error("Failed to parse bulk upload file", e);
            errors.add("Failed to read file: " + e.getMessage());
        }

        return BulkUploadResponse.builder()
                .totalRows(dataRows)
                .successCount(success)
                .failureCount(errors.size() + duplicates.size())
                .errors(errors)
                .duplicates(duplicates)
                .build();
    }

    private BulkUploadResponse failure(String message) {
        return BulkUploadResponse.builder()
                .totalRows(0).successCount(0).failureCount(1)
                .errors(List.of(message)).build();
    }

    @Override
    @Transactional(readOnly = true)
    public DuplicateCheckResponse checkDuplicate(DuplicateCheckRequest req) {
        SimilarityOutcome outcome = similarityService.analyze(
                req.stackId(), req.topicId(),
                req.questionStem(), req.options(), req.excludeId());

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

    /**
     * Parses one data row using the resolved header column map.
     *
     * Format (single layout for both import and export):
     *   Stack | Topic | Difficulty | Question | Option A | Option B | … | Correct Answers
     * Options are filled left-to-right (no gaps). "Correct Answers" holds the option
     * letters of the correct choices, e.g. "A" or "A, C". Extra columns are ignored.
     */
    private McqQuestion parseRow(Row row, Map<String, Integer> col, List<Integer> optionCols,
                                 SmartQuizUserDetails currentUser) {
        String questionStem = getCellString(row, col.get("question"));
        if (questionStem.isBlank()) throw new IllegalArgumentException("Question is empty");
        mcqRepo.findFirstByQuestionStemIgnoreCase(questionStem).ifPresent(existing -> {
            SimilarQuestionResponse match = McqMapper.toSimilarResponse(existing, 1.0);
            throw new DuplicateQuestionException(
                "Duplicate question — already exists in the question bank (ID: " + existing.getId() + ")",
                100.0, 100, List.of(match));
        });

        // Options are contiguous from "Option A": stop at the first blank.
        List<String> options = new ArrayList<>();
        for (int c : optionCols) {
            String v = getCellString(row, c);
            if (v.isBlank()) break;
            options.add(v);
        }
        if (options.size() < 4)
            throw new IllegalArgumentException("At least 4 options required (fill Option A–D, left to right)");

        List<Integer> correctIndices =
                parseCorrectAnswers(getCellString(row, col.get("correct answers")), options.size());

        String difficultyStr = getCellString(row, col.get("difficulty")).toUpperCase();
        Difficulty difficulty;
        try {
            difficulty = Difficulty.valueOf(difficultyStr);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid difficulty '" + difficultyStr + "' (use EASY, MEDIUM or HARD)");
        }

        String stackName = getCellString(row, col.get("stack"));
        if (stackName.isBlank()) throw new IllegalArgumentException("Stack is empty");
        TechnologyStack stack = resolveOrCreateStack(stackName);

        String topicName = getCellString(row, col.get("topic"));
        if (topicName.isBlank()) throw new IllegalArgumentException("Topic is empty");
        Topic topic = resolveOrCreateTopic(stack, topicName);

        return McqQuestion.builder()
                .questionStem(questionStem)
                .options(options)
                .correctOptionIndices(correctIndices)
                .difficulty(difficulty)
                .stack(stack)
                .topic(topic)
                .creator(userRepo.getReferenceById(currentUser.getUserId()))
                .status(McqStatus.DRAFT)
                .build();
    }

    /** Parses a "Correct Answers" cell ("A", "A, C", "A|C", or 1-based numbers) into indices. */
    private List<Integer> parseCorrectAnswers(String raw, int optionCount) {
        if (raw == null || raw.isBlank())
            throw new IllegalArgumentException("Correct answer(s) required (e.g. 'A' or 'A, C')");
        List<Integer> indices = Arrays.stream(raw.split("[,|/;]"))
                .map(String::trim).filter(s -> !s.isBlank())
                .map(token -> {
                    int idx = letterToIndex(token);
                    if (idx < 0 || idx >= optionCount)
                        throw new IllegalArgumentException(
                                "Correct answer '" + token + "' is out of range (only " + optionCount + " options)");
                    return idx;
                })
                .distinct().sorted().toList();
        if (indices.isEmpty())
            throw new IllegalArgumentException("At least one correct answer is required");
        return indices;
    }

    /** A row is blank when its Question, Stack and all Option cells are empty (skipped silently). */
    private boolean isBlankRow(Row row, Map<String, Integer> col, List<Integer> optionCols) {
        if (!getCellString(row, col.get("question")).isBlank()) return false;
        if (!getCellString(row, col.get("stack")).isBlank()) return false;
        for (int c : optionCols) if (!getCellString(row, c).isBlank()) return false;
        return true;
    }

    /** 0-based index → spreadsheet column letter ("A", "B", … "Z", "AA"). */
    private String letter(int index) {
        StringBuilder sb = new StringBuilder();
        int i = index + 1;
        while (i > 0) { int rem = (i - 1) % 26; sb.insert(0, (char) ('A' + rem)); i = (i - 1) / 26; }
        return sb.toString();
    }

    /** Option letter ("A", "C", "AA") or a 1-based number ("1") → 0-based index. */
    private int letterToIndex(String token) {
        String t = token.trim().toUpperCase();
        if (t.isEmpty()) throw new IllegalArgumentException("Empty answer token");
        if (t.chars().allMatch(Character::isDigit)) return Integer.parseInt(t) - 1;
        int idx = 0;
        for (char ch : t.toCharArray()) {
            if (ch < 'A' || ch > 'Z') throw new IllegalArgumentException("Invalid answer token: '" + token + "'");
            idx = idx * 26 + (ch - 'A' + 1);
        }
        return idx - 1;
    }

    /** Lowercase + collapse whitespace for fuzzy name matching. */
    private String normalize(String s) {
        return s == null ? "" : s.trim().replaceAll("\\s+", " ").toLowerCase();
    }

    private TechnologyStack resolveOrCreateStack(String stackName) {
        String norm = normalize(stackName);
        return stackRepo.findAll().stream()
                .filter(s -> normalize(s.getStackName()).equals(norm))
                .findFirst()
                .orElseGet(() -> stackRepo.save(TechnologyStack.builder()
                        .stackName(stackName.trim())
                        .active(true)
                        .build()));
    }

    private Topic resolveOrCreateTopic(TechnologyStack stack, String topicName) {
        String norm = normalize(topicName);
        return topicRepo.findByStackId(stack.getId()).stream()
                .filter(t -> normalize(t.getTopicName()).equals(norm))
                .findFirst()
                .orElseGet(() -> topicRepo.save(Topic.builder()
                        .stack(stack)
                        .topicName(topicName.trim())
                        .active(true)
                        .build()));
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
        // Story 1.3 — "rejected for life": a rejected question is permanently locked from
        // all edits, for everyone including admins.
        if (question.getStatus() == McqStatus.REJECTED) {
            throw new UnauthorizedAccessException(
                "This question has been permanently rejected and can no longer be edited");
        }

        boolean isCreator = question.getCreator().getId().equals(currentUser.getUserId());
        boolean isAdmin = currentUser.getRole() == UserRole.ADMIN;

        boolean creatorEditable = isCreator &&
                (question.getStatus() == McqStatus.DRAFT ||
                 question.getStatus() == McqStatus.READY_FOR_REVIEW ||
                 question.getStatus() == McqStatus.MODIFICATION_REQUESTED);

        if (!creatorEditable && !isAdmin) {
            throw new UnauthorizedAccessException(
                "You can only edit your own questions in DRAFT, READY FOR REVIEW, or MODIFICATION REQUESTED status");
        }
    }

    private void assertCanView(McqQuestion question, SmartQuizUserDetails currentUser) {
        // Any authenticated user may view a question by ID (e.g. via a shared link).
        // Write operations (edit, delete, submit) still enforce ownership/role checks.
    }

    // ── Level 3: Full-text search ──────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<McqResponse> searchQuestions(String query, SmartQuizUserDetails currentUser) {
        if (query == null || query.isBlank()) return List.of();
        List<McqQuestion> results = mcqRepo.searchFullText(query.trim());
        return results.stream()
                .filter(q -> canViewQuestion(q, currentUser))
                .map(McqMapper::toResponse)
                .toList();
    }

    private boolean canViewQuestion(McqQuestion question, SmartQuizUserDetails currentUser) {
        if (currentUser.getRole() == UserRole.ADMIN) return true;
        Long uid = currentUser.getUserId();
        boolean isCreator = question.getCreator().getId().equals(uid);
        boolean isReviewer = question.getReviewer() != null && question.getReviewer().getId().equals(uid);
        return isCreator || isReviewer;
    }

    // ── Level 3: XLSX export ──────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public byte[] exportToXlsx(Long stackId, Long topicId, Difficulty difficulty, McqStatus status) {
        List<McqQuestion> questions = mcqRepo.findForExport(
                status == null ? McqStatus.APPROVED : status, stackId, topicId, difficulty);

        int maxOptions = Math.max(4, questions.stream()
                .mapToInt(q -> q.getOptions() == null ? 0 : q.getOptions().size())
                .max().orElse(4));

        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("Questions");
            CellStyle header = headerStyle(wb);

            // Core round-trip columns first, then read-only metadata (ignored on re-import).
            List<String> headers = new ArrayList<>(List.of("Stack", "Topic", "Difficulty", "Question"));
            for (int i = 0; i < maxOptions; i++) headers.add("Option " + letter(i));
            headers.add("Correct Answers");
            headers.addAll(List.of("Status", "Creator", "Reviewer", "AI Similarity %", "ID"));

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.size(); i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers.get(i));
                cell.setCellStyle(header);
            }

            int rowIdx = 1;
            for (McqQuestion q : questions) {
                Row row = sheet.createRow(rowIdx++);
                int c = 0;
                row.createCell(c++).setCellValue(q.getStack().getStackName());
                row.createCell(c++).setCellValue(q.getTopic().getTopicName());
                row.createCell(c++).setCellValue(q.getDifficulty().name());
                row.createCell(c++).setCellValue(q.getQuestionStem());

                List<String> opts = q.getOptions() != null ? q.getOptions() : List.of();
                for (int i = 0; i < maxOptions; i++) {
                    row.createCell(c++).setCellValue(i < opts.size() ? opts.get(i) : "");
                }

                String correct = q.getCorrectOptionIndices() == null ? "" :
                        q.getCorrectOptionIndices().stream().sorted()
                                .map(this::letter).collect(Collectors.joining(", "));
                row.createCell(c++).setCellValue(correct);

                row.createCell(c++).setCellValue(q.getStatus().name());
                row.createCell(c++).setCellValue(q.getCreator().getFullName());
                row.createCell(c++).setCellValue(q.getReviewer() != null ? q.getReviewer().getFullName() : "");
                row.createCell(c++).setCellValue(
                        q.getAiSimilarityScore() != null ? q.getAiSimilarityScore().doubleValue() * 100 : 0.0);
                row.createCell(c).setCellValue(q.getId());
            }

            for (int i = 0; i < headers.size(); i++) sheet.autoSizeColumn(i);
            return toBytes(wb);
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate XLSX export", e);
        }
    }

    @Override
    public byte[] importTemplate() {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("Questions");
            CellStyle header = headerStyle(wb);

            List<String> headers = List.of("Stack", "Topic", "Difficulty", "Question",
                    "Option A", "Option B", "Option C", "Option D", "Correct Answers");
            Row hr = sheet.createRow(0);
            for (int i = 0; i < headers.size(); i++) {
                Cell cell = hr.createCell(i);
                cell.setCellValue(headers.get(i));
                cell.setCellStyle(header);
            }

            // Example rows — replace Stack/Topic with names that exist in your hub.
            String[][] examples = {
                {"Core Java", "Collections", "EASY", "Which interface does ArrayList implement?",
                 "List", "Set", "Map", "Queue", "A"},
                {"Core Java", "Concurrency", "HARD", "Which of these are thread-safe?",
                 "ArrayList", "ConcurrentHashMap", "Vector", "HashMap", "B, C"},
            };
            int r = 1;
            for (String[] ex : examples) {
                Row row = sheet.createRow(r++);
                for (int i = 0; i < ex.length; i++) row.createCell(i).setCellValue(ex[i]);
            }

            for (int i = 0; i < headers.size(); i++) sheet.autoSizeColumn(i);
            return toBytes(wb);
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate import template", e);
        }
    }

    private CellStyle headerStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.CORNFLOWER_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private byte[] toBytes(Workbook wb) throws IOException {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        wb.write(out);
        return out.toByteArray();
    }

    private Specification<McqQuestion> buildSpec(McqStatus status, Long stackId, Difficulty difficulty,
                                                   String search, SmartQuizUserDetails currentUser) {
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
            addStemSearch(predicates, search, root, cb);

            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    /** Adds a case-insensitive LIKE on questionStem when {@code search} is non-blank. */
    private void addStemSearch(List<jakarta.persistence.criteria.Predicate> predicates, String search,
                               jakarta.persistence.criteria.Root<McqQuestion> root,
                               jakarta.persistence.criteria.CriteriaBuilder cb) {
        if (search != null && !search.isBlank()) {
            String pattern = "%" + search.trim().toLowerCase() + "%";
            predicates.add(cb.like(cb.lower(root.get("questionStem")), pattern));
        }
    }
}
