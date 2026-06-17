package com.accenture.smartquiz.controller;

import com.accenture.smartquiz.entity.User;
import com.accenture.smartquiz.repository.UserRepository;
import com.accenture.smartquiz.security.JwtTokenProvider;
import com.accenture.smartquiz.service.SseEmitterRegistry;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Server-Sent Events stream for real-time notifications.
 *
 * <p>The browser-native {@code EventSource} cannot set an {@code Authorization}
 * header, so the JWT access token is passed as a query parameter and validated
 * by this controller directly (the endpoint is {@code permitAll} in security
 * config). An invalid token yields a 401 via {@link BadCredentialsException}.
 */
@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
@Tag(name = "Notifications", description = "Real-time notification stream (SSE)")
public class NotificationStreamController {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;
    private final SseEmitterRegistry sseEmitterRegistry;

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Open a Server-Sent Events stream for live notifications (token via query param)")
    public SseEmitter stream(@RequestParam String token) {
        if (token == null || token.isBlank() || !jwtTokenProvider.validateToken(token)) {
            throw new BadCredentialsException("Invalid token");
        }

        String enterpriseId = jwtTokenProvider.getEnterpriseIdFromToken(token);
        User user = userRepository.findByEnterpriseId(enterpriseId)
                .orElseThrow(() -> new BadCredentialsException("Invalid token"));

        return sseEmitterRegistry.add(user.getId());
    }
}
