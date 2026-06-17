package com.accenture.smartquiz.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CommentRequest(

        @NotBlank(message = "Comment body is required")
        @Size(max = 2000, message = "Comment must be at most 2000 characters")
        String body
) {}
