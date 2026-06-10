package com.accenture.smartquiz.repository;

import com.accenture.smartquiz.entity.McqQuestion;
import com.accenture.smartquiz.entity.enums.McqStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

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

    @Query("SELECT q FROM McqQuestion q WHERE q.stack.id = :stackId AND q.status = 'APPROVED'")
    List<McqQuestion> findApprovedByStackId(@Param("stackId") Long stackId);

    /** All questions in a given stack + topic — used for duplicate / similarity detection. */
    List<McqQuestion> findByStackIdAndTopicId(Long stackId, Long topicId);

    @Query("SELECT COUNT(q) FROM McqQuestion q WHERE q.reviewer.id = :reviewerId AND q.status = :status")
    long countByReviewerIdAndStatus(@Param("reviewerId") Long reviewerId, @Param("status") McqStatus status);

    boolean existsByQuestionStemIgnoreCase(String questionStem);
}
