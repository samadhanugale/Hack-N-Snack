package com.accenture.smartquiz.service.impl;

import com.accenture.smartquiz.dto.response.MeResponse;
import com.accenture.smartquiz.dto.response.StackSummaryResponse;
import com.accenture.smartquiz.entity.TechnologyStack;
import com.accenture.smartquiz.entity.User;
import com.accenture.smartquiz.entity.UserStackMapping;
import com.accenture.smartquiz.exception.ResourceNotFoundException;
import com.accenture.smartquiz.repository.TechnologyStackRepository;
import com.accenture.smartquiz.repository.UserRepository;
import com.accenture.smartquiz.service.UserProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserProfileServiceImpl implements UserProfileService {

    private final UserRepository userRepo;
    private final TechnologyStackRepository stackRepo;

    @Override
    @Transactional(readOnly = true)
    public MeResponse getMe(Long userId) {
        return toResponse(findById(userId));
    }

    @Override
    @Transactional
    public MeResponse updateMyStacks(Long userId, List<Long> stackIds) {
        User user = findById(userId);
        applyStacks(user, stackIds);
        return toResponse(userRepo.save(user));
    }

    /**
     * Syncs the user's stack assignments to {@code stackIds} as a diff (same approach as the
     * admin path): remove only dropped mappings, insert only genuinely new ones — avoids
     * violating the (user_id, stack_id) unique constraint.
     */
    private void applyStacks(User user, List<Long> stackIds) {
        Set<Long> target = stackIds == null ? Set.of() : new HashSet<>(stackIds);

        user.getStackMappings().removeIf(m -> !target.contains(m.getStack().getId()));

        Set<Long> existing = user.getStackMappings().stream()
                .map(m -> m.getStack().getId())
                .collect(Collectors.toSet());

        target.stream().filter(sid -> !existing.contains(sid)).forEach(sid -> {
            TechnologyStack stack = stackRepo.findById(sid)
                    .orElseThrow(() -> new ResourceNotFoundException("TechnologyStack", sid));
            user.getStackMappings().add(UserStackMapping.builder().user(user).stack(stack).build());
        });
    }

    private User findById(Long id) {
        return userRepo.findById(id).orElseThrow(() -> new ResourceNotFoundException("User", id));
    }

    private MeResponse toResponse(User user) {
        List<StackSummaryResponse> stacks = user.getStackMappings().stream()
                .map(sm -> StackSummaryResponse.builder()
                        .id(sm.getStack().getId())
                        .stackName(sm.getStack().getStackName())
                        .build())
                .toList();

        return new MeResponse(
                user.getId(),
                user.getEnterpriseId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole(),
                stacks);
    }
}
