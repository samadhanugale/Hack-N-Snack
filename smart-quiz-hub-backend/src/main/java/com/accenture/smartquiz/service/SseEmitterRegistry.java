package com.accenture.smartquiz.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * In-memory registry of active {@link SseEmitter} connections keyed by user id.
 * Used to push real-time notifications to connected browsers.
 *
 * <p>Every method is exception-safe: a failure to send to one client must never
 * propagate to the caller (notification creation, etc.).
 */
@Component
@Slf4j
public class SseEmitterRegistry {

    /** No timeout — the server keeps the stream open until the client disconnects. */
    private static final long EMITTER_TIMEOUT_MS = Duration.ofMinutes(30).toMillis();

    private final Map<Long, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    /**
     * Registers a new emitter for the given user, wiring up lifecycle callbacks
     * that remove it on completion/timeout/error, and sends an initial heartbeat
     * so the client knows the stream is live.
     */
    public SseEmitter add(Long userId) {
        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MS);

        emitters.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>()).add(emitter);

        emitter.onCompletion(() -> remove(userId, emitter));
        emitter.onTimeout(() -> {
            emitter.complete();
            remove(userId, emitter);
        });
        emitter.onError(e -> remove(userId, emitter));

        try {
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .comment("stream-open")
                    .data("connected"));
        } catch (Exception e) {
            log.debug("Failed to send initial SSE heartbeat to user {}: {}", userId, e.getMessage());
            remove(userId, emitter);
        }

        log.debug("SSE emitter registered for user {} (now {} connection(s))",
                userId, emitters.getOrDefault(userId, List.of()).size());
        return emitter;
    }

    /**
     * Sends an event to every active emitter belonging to the user. Emitters that
     * throw are completed and removed. Never throws.
     */
    public void sendToUser(Long userId, String eventName, Object data) {
        List<SseEmitter> userEmitters = emitters.get(userId);
        if (userEmitters == null || userEmitters.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : userEmitters) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(data));
            } catch (IOException | RuntimeException e) {
                log.debug("Removing dead SSE emitter for user {}: {}", userId, e.getMessage());
                try {
                    emitter.complete();
                } catch (Exception ignored) {
                    // already torn down
                }
                remove(userId, emitter);
            }
        }
    }

    private void remove(Long userId, SseEmitter emitter) {
        List<SseEmitter> userEmitters = emitters.get(userId);
        if (userEmitters != null) {
            userEmitters.remove(emitter);
            if (userEmitters.isEmpty()) {
                emitters.remove(userId);
            }
        }
    }
}
