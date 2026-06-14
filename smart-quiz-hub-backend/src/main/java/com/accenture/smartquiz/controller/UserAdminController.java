package com.accenture.smartquiz.controller;

import com.accenture.smartquiz.dto.request.CreateUserRequest;
import com.accenture.smartquiz.dto.request.ResetPasswordRequest;
import com.accenture.smartquiz.dto.request.UpdateUserRequest;
import com.accenture.smartquiz.dto.response.AdminUserResponse;
import com.accenture.smartquiz.dto.response.ApiResponse;
import com.accenture.smartquiz.entity.enums.UserRole;
import com.accenture.smartquiz.security.SmartQuizUserDetails;
import com.accenture.smartquiz.service.UserAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Tag(name = "User Admin", description = "Super-admin user management (create / manage SMEs & admins)")
public class UserAdminController {

    private final UserAdminService userAdminService;

    @GetMapping
    @Operation(summary = "List users (optionally filtered by role)")
    public ResponseEntity<ApiResponse<List<AdminUserResponse>>> list(
            @RequestParam(required = false) UserRole role) {
        return ResponseEntity.ok(ApiResponse.success(userAdminService.listUsers(role)));
    }

    @PostMapping
    @Operation(summary = "Create a new user (SME or Admin)")
    public ResponseEntity<ApiResponse<AdminUserResponse>> create(@Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("User created", userAdminService.createUser(request)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a user's profile, role, status and stack assignments")
    public ResponseEntity<ApiResponse<AdminUserResponse>> update(
            @PathVariable Long id, @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(ApiResponse.success("User updated", userAdminService.updateUser(id, request)));
    }

    @PatchMapping("/{id}/active")
    @Operation(summary = "Activate or deactivate a user")
    public ResponseEntity<ApiResponse<AdminUserResponse>> setActive(
            @PathVariable Long id,
            @RequestParam boolean active,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(
                userAdminService.setActive(id, active, currentUser.getUserId())));
    }

    @PostMapping("/{id}/reset-password")
    @Operation(summary = "Reset a user's password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(
            @PathVariable Long id, @Valid @RequestBody ResetPasswordRequest request) {
        userAdminService.resetPassword(id, request.password());
        return ResponseEntity.ok(ApiResponse.success("Password reset"));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a user (only if they have no questions; otherwise deactivate)")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        userAdminService.deleteUser(id, currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success("User deleted"));
    }
}
