package com.accenture.smartquiz.dto.request;

import com.accenture.smartquiz.entity.enums.McqStatus;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record BulkDecisionRequest(

        @NotEmpty(message = "At least one question ID is required")
        @Size(max = 100, message = "Cannot bulk-decide more than 100 questions at once")
        List<Long> questionIds,

        @NotNull(message = "Decision is required")
        McqStatus decision,

        String comments
) {}
