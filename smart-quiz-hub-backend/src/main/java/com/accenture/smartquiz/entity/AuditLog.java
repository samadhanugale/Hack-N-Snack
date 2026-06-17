package com.accenture.smartquiz.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * Immutable record of a single mutation on an MCQ question ("who changed what, when").
 *
 * <p>{@code action} is stored as a plain String (e.g. CREATED, UPDATED, SUBMITTED,
 * ASSIGNED, APPROVED, REJECTED, MODIFICATION_REQUESTED, DELETED) — no enum, mirroring
 * how {@code status} is modelled on mcq_questions. {@code performedByName} is a
 * denormalized snapshot so history survives deletion of the acting user.
 */
@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "question_id")
    private Long questionId;

    @Column(nullable = false, length = 50)
    private String action;

    @Column(name = "performed_by")
    private Long performedBy;

    @Column(name = "performed_by_name", length = 200)
    private String performedByName;

    @Column(columnDefinition = "TEXT")
    private String details;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
