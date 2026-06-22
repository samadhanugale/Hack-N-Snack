package com.accenture.smartquiz.entity;

import com.accenture.smartquiz.entity.enums.Difficulty;
import com.accenture.smartquiz.entity.enums.McqStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "mcq_questions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class McqQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "question_stem", nullable = false, columnDefinition = "TEXT")
    private String questionStem;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "options", nullable = false, columnDefinition = "jsonb")
    private List<String> options;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "correct_option_indices", nullable = false, columnDefinition = "jsonb")
    private List<Integer> correctOptionIndices;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private Difficulty difficulty;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stack_id", nullable = false)
    private TechnologyStack stack;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "topic_id", nullable = false)
    private Topic topic;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    @Builder.Default
    private McqStatus status = McqStatus.DRAFT;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "creator_id", nullable = false)
    private User creator;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewer_id")
    private User reviewer;

    @Column(name = "reviewer_comments", columnDefinition = "TEXT")
    private String reviewerComments;

    @Column(name = "ai_similarity_score", precision = 5, scale = 4)
    private BigDecimal aiSimilarityScore;

    @Version
    @Column(nullable = false)
    private Long version;

    /** Set when the creator submits (or resubmits) for review — baseline for turnaround analytics. */
    @Column(name = "submitted_at")
    private Instant submittedAt;

    /** Set when a reviewer records a decision (approve/reject/request changes). */
    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    /** Set when the current reviewer assignment starts — baseline for the review SLA clock. */
    @Column(name = "assigned_at")
    private Instant assignedAt;

    /** Set when the SLA reminder was pushed to the reviewer (null = not yet reminded). */
    @Column(name = "reminder_sent_at")
    private Instant reminderSentAt;

    /** Set when the SLA escalation was pushed to admins (null = not yet escalated). */
    @Column(name = "escalated_at")
    private Instant escalatedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
