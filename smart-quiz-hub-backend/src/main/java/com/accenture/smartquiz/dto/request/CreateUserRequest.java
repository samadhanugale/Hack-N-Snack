package com.accenture.smartquiz.dto.request;

import com.accenture.smartquiz.entity.enums.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateUserRequest(

        @NotBlank(message = "Enterprise ID is required")
        @Size(max = 100, message = "Enterprise ID is too long")
        String enterpriseId,

        @NotBlank(message = "Full name is required")
        @Size(max = 200, message = "Full name is too long")
        String fullName,

        @NotBlank(message = "Email is required")
        @Email(message = "A valid email is required")
        @Size(max = 255, message = "Email is too long")
        String email,

        @NotBlank(message = "Password is required")
        @Size(min = 8, max = 100, message = "Password must be 8–100 characters")
        String password,

        @NotNull(message = "Role is required")
        UserRole role,

        /** Optional stacks the user (SME) is responsible for. */
        List<Long> stackIds
) {}
