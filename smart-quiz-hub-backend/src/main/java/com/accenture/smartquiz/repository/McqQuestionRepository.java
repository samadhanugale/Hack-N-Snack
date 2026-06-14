package com.accenture.smartquiz.repository;

import com.accenture.smartquiz.entity.McqQuestion;
import com.accenture.smartquiz.entity.enums.Difficulty;
import com.accenture.smartquiz.entity.enums.McqStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

/**
 * JPQL queries are externalized to {@code META-INF/jpa-named-queries.properties}
 * and referenced here by name ({@code McqQuestion.<method>}). Only the PostgreSQL-specific
 * native queries (FTS, date_trunc, EXTRACT EPOCH) remain inline — they are not JPQL.
 */
public interface McqQuestionRepository extends JpaRepository<McqQuestion, Long>,
        JpaSpecificationExecutor<McqQuestion> {

    Page<McqQuestion> findByCreatorId(Long creatorId, Pageable pageable);

    Page<McqQuestion> findByCreatorIdAndStatus(Long creatorId, McqStatus status, Pageable pageable);

    Page<McqQuestion> findByReviewerIdAndStatus(Long reviewerId, McqStatus status, Pageable pageable);

    Page<McqQuestion> findByReviewerIdAndStatusIn(Long reviewerId, List<McqStatus> statuses, Pageable pageable);

    Page<McqQuestion> findByStatus(McqStatus status, Pageable pageable);

    long countByCreatorId(Long creatorId);

    long countByCreatorIdAndStatus(Long creatorId, McqStatus status);

    long countByStatus(McqStatus status);

    long countByReviewerId(Long reviewerId);

    boolean existsByCreatorId(Long creatorId);

    boolean existsByReviewerId(Long reviewerId);

    @Query(name = "McqQuestion.findApprovedByStackId")
    List<McqQuestion> findApprovedByStackId(@Param("stackId") Long stackId);

    /** All questions in a given stack + topic — used for duplicate / similarity detection. */
    List<McqQuestion> findByStackIdAndTopicId(Long stackId, Long topicId);

    @Query(name = "McqQuestion.countByReviewerIdAndStatus")
    long countByReviewerIdAndStatus(@Param("reviewerId") Long reviewerId, @Param("status") McqStatus status);

    boolean existsByQuestionStemIgnoreCase(String questionStem);

    /** Full-text search using the pre-built tsvector column (ranked by relevance) — native. */
    @Query(value = """
            SELECT * FROM mcq_questions
            WHERE search_vector @@ plainto_tsquery('english', :query)
            ORDER BY ts_rank(search_vector, plainto_tsquery('english', :query)) DESC
            """, nativeQuery = true)
    List<McqQuestion> searchFullText(@Param("query") String query);

    /** Filtered export query — null params are treated as "all". */
    @Query(name = "McqQuestion.findForExport")
    List<McqQuestion> findForExport(@Param("status") McqStatus status,
                                    @Param("stackId") Long stackId,
                                    @Param("topicId") Long topicId,
                                    @Param("difficulty") Difficulty difficulty);

    /** Analytics: count questions grouped by stack (returns [stackName, count]). */
    @Query(name = "McqQuestion.countByStack")
    List<Object[]> countByStack();

    /** Analytics: count questions grouped by difficulty. */
    @Query(name = "McqQuestion.countByDifficulty")
    List<Object[]> countByDifficulty();

    /** Analytics: per-reviewer UNDER_REVIEW count. */
    @Query(name = "McqQuestion.reviewerWorkload")
    List<Object[]> reviewerWorkload();

    /** Analytics: questions created per week for the last 12 weeks — native. */
    @Query(value = """
            SELECT date_trunc('week', created_at)::DATE AS week, COUNT(*) AS cnt
            FROM mcq_questions
            WHERE created_at >= NOW() - INTERVAL '12 weeks'
            GROUP BY 1 ORDER BY 1
            """, nativeQuery = true)
    List<Object[]> weeklyCreationTrend();

    /** Auto-assign: READY_FOR_REVIEW questions that have no reviewer yet. */
    @Query(name = "McqQuestion.findUnassignedReadyForReview")
    List<McqQuestion> findUnassignedReadyForReview();

    // ── Date-range analytics (Epic 2) — callers pass concrete [start, end) bounds ──

    /** [status, count] for questions created within the range. */
    @Query(name = "McqQuestion.countByStatusInRange")
    List<Object[]> countByStatusInRange(@Param("start") Instant start, @Param("end") Instant end);

    /** [stackName, count] for questions created within the range. */
    @Query(name = "McqQuestion.countByStackInRange")
    List<Object[]> countByStackInRange(@Param("start") Instant start, @Param("end") Instant end);

    /** [difficulty, count] for questions created within the range. */
    @Query(name = "McqQuestion.countByDifficultyInRange")
    List<Object[]> countByDifficultyInRange(@Param("start") Instant start, @Param("end") Instant end);

    /** [weekStartDate, count] creation trend within the range — native. */
    @Query(value = """
            SELECT date_trunc('week', created_at)::DATE AS week, COUNT(*) AS cnt
            FROM mcq_questions
            WHERE created_at >= :start AND created_at < :end
            GROUP BY 1 ORDER BY 1
            """, nativeQuery = true)
    List<Object[]> weeklyCreationTrendInRange(@Param("start") Instant start, @Param("end") Instant end);

    /** Average ai_similarity_score (0..1) for questions created in range; null when none. */
    @Query(name = "McqQuestion.avgSimilarityInRange")
    Double avgSimilarityInRange(@Param("start") Instant start, @Param("end") Instant end);

    // ── Per-SME report aggregates (Epic 2 / Story 2.1) ──

    /** [creatorId, count] of questions authored within the range. */
    @Query(name = "McqQuestion.authoredCountsByCreator")
    List<Object[]> authoredCountsByCreator(@Param("start") Instant start, @Param("end") Instant end);

    /** [reviewerId, status, count] of decisions recorded within the range. */
    @Query(name = "McqQuestion.reviewDecisionCountsByReviewer")
    List<Object[]> reviewDecisionCountsByReviewer(@Param("start") Instant start, @Param("end") Instant end);

    /** [reviewerId, avgSeconds] turnaround (reviewed_at - submitted_at) for decisions in range — native. */
    @Query(value = """
            SELECT reviewer_id, AVG(EXTRACT(EPOCH FROM (reviewed_at - submitted_at)))
            FROM mcq_questions
            WHERE reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL AND submitted_at IS NOT NULL
              AND reviewed_at >= :start AND reviewed_at < :end
            GROUP BY reviewer_id
            """, nativeQuery = true)
    List<Object[]> avgTurnaroundSecondsByReviewer(@Param("start") Instant start, @Param("end") Instant end);

    /** [reviewerId, count] currently UNDER_REVIEW (current backlog, not range-bound). */
    @Query(name = "McqQuestion.pendingCountsByReviewer")
    List<Object[]> pendingCountsByReviewer();
}
