package com.accenture.smartquiz.dto.request;

import com.accenture.smartquiz.entity.enums.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpdateUserRequest(

        @NotBlank(message = "Full name is required")
        @Size(max = 200, message = "Full name is too long")
        String fullName,

        @NotBlank(message = "Email is required")
        @Email(message = "A valid email is required")
        @Size(max = 255, message = "Email is too long")
        String email,

        @NotNull(message = "Role is required")
        UserRole role,

        boolean active,

        List<Long> stackIds
) {}
