package com.accenture.smartquiz.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Payload for the AI-driven duplicate / similarity check performed on the
 * Edit page (Level 2). The candidate question does not need to be persisted —
 * similarity is computed against existing questions in the same stack + topic.
 */
@Data
public class DuplicateCheckRequest {

    @NotNull(message = "Stack ID is required")
    private Long stackId;

    @NotNull(message = "Topic ID is required")
    private Long topicId;

    @NotBlank(message = "Question stem is required")
    private String questionStem;

    @NotBlank(message = "Option A is required")
    private String optionA;

    @NotBlank(message = "Option B is required")
    private String optionB;

    @NotBlank(message = "Option C is required")
    private String optionC;

    @NotBlank(message = "Option D is required")
    private String optionD;

    /** When editing an existing question, exclude it from the comparison. */
    private Long excludeId;
}
