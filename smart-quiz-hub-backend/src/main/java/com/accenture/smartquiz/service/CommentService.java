package com.accenture.smartquiz.service;

import com.accenture.smartquiz.dto.request.CommentRequest;
import com.accenture.smartquiz.dto.response.CommentResponse;
import com.accenture.smartquiz.security.SmartQuizUserDetails;

import java.util.List;

public interface CommentService {

    /**
     * Returns the discussion thread for a question, oldest first. Enforces the same
     * per-question visibility rule as the MCQ service: only the creator, the assigned
     * reviewer, or an admin may read it.
     */
    List<CommentResponse> getComments(Long questionId, SmartQuizUserDetails user);

    /**
     * Appends a comment to a question's discussion thread, snapshotting the author's
     * name and role. Subject to the same visibility rule as {@link #getComments}.
     */
    CommentResponse addComment(Long questionId, CommentRequest req, SmartQuizUserDetails user);
}
