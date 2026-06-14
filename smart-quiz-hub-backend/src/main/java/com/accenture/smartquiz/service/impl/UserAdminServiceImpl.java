package com.accenture.smartquiz.service.impl;

import com.accenture.smartquiz.dto.request.CreateUserRequest;
import com.accenture.smartquiz.dto.request.UpdateUserRequest;
import com.accenture.smartquiz.dto.response.AdminUserResponse;
import com.accenture.smartquiz.dto.response.StackSummaryResponse;
import com.accenture.smartquiz.entity.TechnologyStack;
import com.accenture.smartquiz.entity.User;
import com.accenture.smartquiz.entity.UserStackMapping;
import com.accenture.smartquiz.entity.enums.McqStatus;
import com.accenture.smartquiz.entity.enums.UserRole;
import com.accenture.smartquiz.exception.ResourceNotFoundException;
import com.accenture.smartquiz.repository.McqQuestionRepository;
import com.accenture.smartquiz.repository.TechnologyStackRepository;
import com.accenture.smartquiz.repository.UserRepository;
import com.accenture.smartquiz.service.UserAdminService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserAdminServiceImpl implements UserAdminService {

    private final UserRepository userRepo;
    private final McqQuestionRepository mcqRepo;
    private final TechnologyStackRepository stackRepo;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional(readOnly = true)
    public List<AdminUserResponse> listUsers(UserRole role) {
        List<User> users = role != null ? userRepo.findByRole(role) : userRepo.findAllByOrderByFullNameAsc();
        return users.stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional
    public AdminUserResponse createUser(CreateUserRequest req) {
        if (userRepo.existsByEnterpriseId(req.enterpriseId().trim())) {
            throw new IllegalArgumentException("Enterprise ID '" + req.enterpriseId() + "' is already taken");
        }
        if (userRepo.existsByEmail(req.email().trim())) {
            throw new IllegalArgumentException("Email '" + req.email() + "' is already registered");
        }

        User user = User.builder()
                .enterpriseId(req.enterpriseId().trim())
                .fullName(req.fullName().trim())
                .email(req.email().trim())
                .password(passwordEncoder.encode(req.password()))
                .role(req.role())
                .active(true)
                .build();
        applyStacks(user, req.stackIds());

        User saved = userRepo.save(user);
        log.info("Admin created user {} ({})", saved.getEnterpriseId(), saved.getRole());
        return toResponse(saved);
    }

    @Override
    @Transactional
    public AdminUserResponse updateUser(Long id, UpdateUserRequest req) {
        User user = findById(id);

        String newEmail = req.email().trim();
        if (!newEmail.equalsIgnoreCase(user.getEmail()) && userRepo.existsByEmail(newEmail)) {
            throw new IllegalArgumentException("Email '" + newEmail + "' is already registered");
        }

        user.setFullName(req.fullName().trim());
        user.setEmail(newEmail);
        user.setRole(req.role());
        user.setActive(req.active());
        applyStacks(user, req.stackIds());

        return toResponse(userRepo.save(user));
    }

    @Override
    @Transactional
    public AdminUserResponse setActive(Long id, boolean active, Long currentUserId) {
        if (id.equals(currentUserId) && !active) {
            throw new IllegalArgumentException("You cannot deactivate your own account");
        }
        User user = findById(id);
        user.setActive(active);
        return toResponse(userRepo.save(user));
    }

    @Override
    @Transactional
    public void resetPassword(Long id, String newPassword) {
        User user = findById(id);
        user.setPassword(passwordEncoder.encode(newPassword));
        log.info("Admin reset password for user {}", user.getEnterpriseId());
    }

    @Override
    @Transactional
    public void deleteUser(Long id, Long currentUserId) {
        if (id.equals(currentUserId)) {
            throw new IllegalArgumentException("You cannot delete your own account");
        }
        User user = findById(id);
        if (mcqRepo.existsByCreatorId(id) || mcqRepo.existsByReviewerId(id)) {
            throw new IllegalArgumentException(
                    "This user has authored or reviewed questions and cannot be deleted — deactivate them instead");
        }
        userRepo.delete(user);
        log.info("Admin deleted user {}", user.getEnterpriseId());
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    /** Replaces the user's stack assignments with the given stack ids (orphanRemoval clears the rest). */
    private void applyStacks(User user, List<Long> stackIds) {
        user.getStackMappings().clear();
        if (stackIds == null) return;
        stackIds.stream().distinct().forEach(sid -> {
            TechnologyStack stack = stackRepo.findById(sid)
                    .orElseThrow(() -> new ResourceNotFoundException("TechnologyStack", sid));
            user.getStackMappings().add(UserStackMapping.builder().user(user).stack(stack).build());
        });
    }

    private User findById(Long id) {
        return userRepo.findById(id).orElseThrow(() -> new ResourceNotFoundException("User", id));
    }

    private AdminUserResponse toResponse(User user) {
        List<StackSummaryResponse> stacks = user.getStackMappings().stream()
                .map(sm -> StackSummaryResponse.builder()
                        .id(sm.getStack().getId())
                        .stackName(sm.getStack().getStackName())
                        .build())
                .toList();

        return new AdminUserResponse(
                user.getId(),
                user.getEnterpriseId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole(),
                user.isActive(),
                stacks,
                mcqRepo.countByCreatorId(user.getId()),
                mcqRepo.countByCreatorIdAndStatus(user.getId(), McqStatus.APPROVED),
                mcqRepo.countByReviewerId(user.getId()),
                user.getCreatedAt());
    }
}
