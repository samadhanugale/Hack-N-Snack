package com.accenture.smartquiz.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * A single message in a question's review discussion thread.
 *
 * <p>The thread is a flat chronological list of comments exchanged between the
 * question's creator and its reviewer/admins. {@code authorName} and
 * {@code authorRole} are denormalized snapshots taken at the time the comment is
 * written, so the thread survives deletion of the author and reflects the role the
 * author held when commenting. {@code authorRole} is stored as a plain String
 * (e.g. SME, ADMIN), mirroring how {@code status} is modelled on mcq_questions.
 */
@Entity
@Table(name = "question_comments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuestionComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "question_id", nullable = false)
    private Long questionId;

    @Column(name = "author_id")
    private Long authorId;

    @Column(name = "author_name", nullable = false, length = 200)
    private String authorName;

    @Column(name = "author_role", length = 50)
    private String authorRole;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
