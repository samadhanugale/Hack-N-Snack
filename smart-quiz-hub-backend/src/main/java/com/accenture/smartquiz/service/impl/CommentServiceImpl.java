package com.accenture.smartquiz.service.impl;

import com.accenture.smartquiz.dto.request.CommentRequest;
import com.accenture.smartquiz.dto.response.CommentResponse;
import com.accenture.smartquiz.entity.McqQuestion;
import com.accenture.smartquiz.entity.QuestionComment;
import com.accenture.smartquiz.entity.User;
import com.accenture.smartquiz.entity.enums.NotificationType;
import com.accenture.smartquiz.entity.enums.UserRole;
import com.accenture.smartquiz.exception.ResourceNotFoundException;
import com.accenture.smartquiz.exception.UnauthorizedAccessException;
import com.accenture.smartquiz.repository.McqQuestionRepository;
import com.accenture.smartquiz.repository.QuestionCommentRepository;
import com.accenture.smartquiz.security.SmartQuizUserDetails;
import com.accenture.smartquiz.service.CommentService;
import com.accenture.smartquiz.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class CommentServiceImpl implements CommentService {

    private final QuestionCommentRepository commentRepo;
    private final McqQuestionRepository mcqRepo;
    private final NotificationService notificationService;

    @Override
    @Transactional(readOnly = true)
    public List<CommentResponse> getComments(Long questionId, SmartQuizUserDetails user) {
        McqQuestion question = findQuestionById(questionId);
        assertCanView(question, user);
        return commentRepo.findByQuestionIdOrderByCreatedAtAsc(questionId).stream()
                .map(CommentResponse::from)
                .toList();
    }

    @Override
    @Transactional
    public CommentResponse addComment(Long questionId, CommentRequest req, SmartQuizUserDetails user) {
        McqQuestion question = findQuestionById(questionId);
        assertCanView(question, user);

        QuestionComment comment = commentRepo.save(QuestionComment.builder()
                .questionId(questionId)
                .authorId(user.getUserId())
                .authorName(user.getFullName())          // snapshot of the author's name
                .authorRole(user.getRole().name())       // snapshot of the author's role
                .body(req.body())
                .build());

        notifyOtherParty(question, user);

        return CommentResponse.from(comment);
    }

    /**
     * Notifies the "other party" in the discussion when a comment is added:
     * if the author is the creator, the assigned reviewer (if any) is notified;
     * otherwise (author is reviewer/admin) the creator is notified. Best-effort —
     * a self-comment or a missing counterpart simply results in no notification.
     */
    private void notifyOtherParty(McqQuestion question, SmartQuizUserDetails author) {
        Long authorId = author.getUserId();
        Long creatorId = question.getCreator().getId();
        User reviewer = question.getReviewer();

        Long recipientId = authorId.equals(creatorId)
                ? (reviewer != null ? reviewer.getId() : null)
                : creatorId;

        if (recipientId == null || recipientId.equals(authorId)) {
            return;
        }

        try {
            notificationService.push(
                    recipientId,
                    NotificationType.NEW_COMMENT,
                    "New comment on a question",
                    author.getFullName() + " commented on question #" + question.getId(),
                    question.getId());
        } catch (Exception e) {
            // Notifying the counterpart must never break adding the comment.
            log.warn("Failed to notify user {} of new comment on question {}: {}",
                    recipientId, question.getId(), e.getMessage());
        }
    }

    private McqQuestion findQuestionById(Long id) {
        return mcqRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("McqQuestion", id));
    }

    /**
     * Any authenticated user may read and post to the discussion thread of a question
     * they can view (i.e. anyone who holds a valid JWT). Write operations on the
     * question itself (edit, delete, review) still enforce ownership/role checks.
     */
    private void assertCanView(McqQuestion question, SmartQuizUserDetails currentUser) {
        // Open to all authenticated users — access is gated at the JWT level.
    }
}
