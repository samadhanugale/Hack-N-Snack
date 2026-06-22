package com.accenture.smartquiz.controller;

import com.accenture.smartquiz.dto.request.UpdateMyStacksRequest;
import com.accenture.smartquiz.dto.response.ApiResponse;
import com.accenture.smartquiz.dto.response.MeResponse;
import com.accenture.smartquiz.security.SmartQuizUserDetails;
import com.accenture.smartquiz.service.UserProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
@Tag(name = "User Profile", description = "Self-service profile for the current user")
public class UserController {

    private final UserProfileService userProfileService;

    @GetMapping("/me")
    @Operation(summary = "Get the current user's profile, including their stack assignments")
    public ResponseEntity<ApiResponse<MeResponse>> me(
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(userProfileService.getMe(currentUser.getUserId())));
    }

    @PutMapping("/me/stacks")
    @Operation(summary = "Update the current user's own stack (skill) assignments")
    public ResponseEntity<ApiResponse<MeResponse>> updateMyStacks(
            @RequestBody UpdateMyStacksRequest request,
            @AuthenticationPrincipal SmartQuizUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(
                userProfileService.updateMyStacks(currentUser.getUserId(), request.stackIds())));
    }
}
