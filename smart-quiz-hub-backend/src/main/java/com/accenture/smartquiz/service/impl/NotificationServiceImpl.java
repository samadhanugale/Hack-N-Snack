package com.accenture.smartquiz.service.impl;

import com.accenture.smartquiz.dto.response.NotificationResponse;
import com.accenture.smartquiz.dto.response.PagedResponse;
import com.accenture.smartquiz.entity.Notification;
import com.accenture.smartquiz.entity.User;
import com.accenture.smartquiz.entity.enums.NotificationType;
import com.accenture.smartquiz.repository.NotificationRepository;
import com.accenture.smartquiz.repository.UserRepository;
import com.accenture.smartquiz.service.NotificationService;
import com.accenture.smartquiz.service.SseEmitterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notifRepo;
    private final UserRepository userRepo;
    private final SseEmitterRegistry sseEmitterRegistry;

    @Override
    @Transactional
    public void push(Long userId, NotificationType type, String title, String message, Long questionId) {
        User user = userRepo.getReferenceById(userId);
        Notification n = Notification.builder()
                .user(user)
                .type(type)
                .title(title)
                .message(message)
                .questionId(questionId)
                .build();
        notifRepo.save(n);
        log.debug("Notification [{}] pushed to user {}", type, userId);

        // Best-effort real-time push over SSE. Must never break notification creation.
        try {
            sseEmitterRegistry.sendToUser(userId, "notification", NotificationResponse.from(n));
        } catch (Exception e) {
            log.warn("Failed to push SSE notification to user {}: {}", userId, e.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<NotificationResponse> getForUser(Long userId, Pageable pageable) {
        return PagedResponse.of(
                notifRepo.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                         .map(NotificationResponse::from));
    }

    @Override
    @Transactional(readOnly = true)
    public long countUnread(Long userId) {
        return notifRepo.countByUserIdAndReadFalse(userId);
    }

    @Override
    @Transactional
    public void markRead(Long userId, Long notificationId) {
        notifRepo.markRead(notificationId, userId);
    }

    @Override
    @Transactional
    public void markAllRead(Long userId) {
        notifRepo.markAllRead(userId);
    }
}
