package com.accenture.smartquiz.service.impl;

import com.accenture.smartquiz.dto.response.AiReviewResponse;
import com.accenture.smartquiz.dto.response.AiReviewResponse.Issue;
import com.accenture.smartquiz.entity.McqQuestion;
import com.accenture.smartquiz.exception.ResourceNotFoundException;
import com.accenture.smartquiz.repository.McqQuestionRepository;
import com.accenture.smartquiz.service.AiReviewService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * AI Review Assistant implementation.
 *
 * <p>The HTTP call mirrors {@code AiQuestionServiceImpl.callAi}: a direct {@link RestClient}
 * POST to the OpenAI-compatible chat-completions endpoint, parsed with Jackson's
 * {@code readTree} so provider-specific extra fields are tolerated. The completions path is
 * configurable (default {@code /v1/chat/completions}) so GitHub Models
 * ({@code /chat/completions}) can be targeted via {@code OPENAI_COMPLETIONS_PATH}.</p>
 *
 * <p>If the LLM is unavailable, errors, or returns blank/unparseable content, a deterministic
 * heuristic analysis is returned instead ({@code aiPowered = false}). This method never throws.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiReviewServiceImpl implements AiReviewService {

    private final McqQuestionRepository mcqRepo;
    private final ObjectMapper objectMapper;

    @Value("${spring.ai.openai.base-url}")
    private String baseUrl;

    @Value("${spring.ai.openai.api-key}")
    private String apiKey;

    @Value("${spring.ai.openai.chat.options.model}")
    private String model;

    @Value("${spring.ai.openai.chat.options.temperature:0.7}")
    private double temperature;

    @Value("${spring.ai.openai.chat.options.max-tokens:1000}")
    private int maxTokens;

    /**
     * Completions path — overridable for GitHub Models (set
     * {@code OPENAI_COMPLETIONS_PATH=/chat/completions}). Defaults to the OpenAI/Groq path.
     */
    @Value("${OPENAI_COMPLETIONS_PATH:/v1/chat/completions}")
    private String completionsPath;

    // Bounded timeouts so a slow/unreachable model never hangs the request — on timeout
    // the call throws, and analyze() falls back to the deterministic heuristic.
    private final RestClient restClient = RestClient.builder()
            .requestFactory(timeoutFactory())
            .build();

    private static SimpleClientHttpRequestFactory timeoutFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(25));
        return factory;
    }

    @Override
    @Transactional(readOnly = true)
    public AiReviewResponse analyze(Long questionId) {
        McqQuestion question = mcqRepo.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("McqQuestion", questionId));

        try {
            AiReviewResponse ai = callAi(question);
            if (ai != null) {
                return ai;
            }
            log.info("AI review returned no usable content - using heuristic analysis for question {}", questionId);
        } catch (Exception e) {
            log.error("AI review failed for question {} - using heuristic analysis: {}", questionId, e.getMessage());
        }
        return heuristic(question);
    }

    // ------------------------------------------------------------------
    //  AI chat (OpenAI-compatible)
    // ------------------------------------------------------------------

    /**
     * Calls the chat-completions endpoint and parses a single JSON OBJECT into a review.
     * Returns {@code null} when the content is blank / unparseable so the caller can fall back.
     */
    private AiReviewResponse callAi(McqQuestion q) throws Exception {
        Map<String, Object> requestBody = Map.of(
                "model", model,
                "temperature", temperature,
                "max_tokens", maxTokens,
                "messages", List.of(Map.of("role", "user", "content", buildPrompt(q)))
        );

        String responseBody = restClient.post()
                .uri(baseUrl + completionsPath)
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .body(String.class);

        JsonNode root = objectMapper.readTree(responseBody);
        String content = root.path("choices").path(0).path("message").path("content").asText();

        String json = extractJsonObject(content);
        if (json == null) {
            return null;
        }

        JsonNode node = objectMapper.readTree(json);
        if (!node.isObject()) {
            return null;
        }

        int score = clampScore(node.path("qualityScore").asInt(0));
        String difficulty = normalizeDifficulty(node.path("suggestedDifficulty").asText(null), q);
        String summary = textOrDefault(node.path("summary"), "AI quality analysis completed.");
        String answerExplanation = textOrDefault(node.path("answerExplanation"),
                heuristicExplanation(q));

        List<Issue> issues = new ArrayList<>();
        JsonNode issuesNode = node.path("issues");
        if (issuesNode.isArray()) {
            for (JsonNode issue : issuesNode) {
                String severity = normalizeSeverity(issue.path("severity").asText(null));
                String message = issue.path("message").asText("").trim();
                if (!message.isBlank()) {
                    issues.add(new Issue(severity, message));
                }
            }
        }

        List<String> suggestions = new ArrayList<>();
        JsonNode suggestionsNode = node.path("suggestions");
        if (suggestionsNode.isArray()) {
            for (JsonNode tip : suggestionsNode) {
                String text = tip.asText("").trim();
                if (!text.isBlank()) {
                    suggestions.add(text);
                }
            }
        }

        AiReviewResponse.AnswerCheck answerCheck = parseAnswerCheck(node.path("answerCheck"), q);
        return new AiReviewResponse(score, difficulty, summary, issues, answerExplanation, suggestions, true, answerCheck);
    }

    private String buildPrompt(McqQuestion q) {
        StringBuilder options = new StringBuilder();
        List<String> opts = q.getOptions() == null ? List.of() : q.getOptions();
        List<Integer> correct = q.getCorrectOptionIndices() == null ? List.of() : q.getCorrectOptionIndices();
        for (int i = 0; i < opts.size(); i++) {
            char letter = (char) ('A' + i);
            options.append(letter).append(") ").append(opts.get(i))
                    .append(correct.contains(i) ? "   [marked CORRECT]" : "")
                    .append('\n');
        }

        return """
                You are an expert technical assessment reviewer. Analyze the quality of the following
                multiple-choice question and help a human reviewer decide whether it is good.

                Question stem:
                %s

                Options:
                %s
                Current difficulty: %s

                Evaluate it and respond with ONLY a single valid JSON OBJECT (not an array, no extra text,
                no markdown fences) with EXACTLY these keys:
                {
                  "qualityScore": <integer 0-100>,
                  "suggestedDifficulty": "EASY|MEDIUM|HARD",
                  "summary": "<one sentence overall assessment>",
                  "issues": [ { "severity": "INFO|WARNING|CRITICAL", "message": "<short issue>" } ],
                  "answerExplanation": "<why the correct option(s) are right>",
                  "suggestions": [ "<short improvement tip>" ],
                  "answerCheck": {
                    "correctAnswerInOptions": <true|false — is the genuinely correct answer present among the options listed above?>,
                    "currentAnswerCorrect": <true|false — are the option(s) currently MARKED CORRECT actually right?>,
                    "correctAnswerText": "<state the genuinely correct answer in plain words>",
                    "proposedOptions": [ "<corrected option 1>", "<corrected option 2>", "<corrected option 3>", "<corrected option 4>" ],
                    "proposedCorrectIndices": [ <0-based index/indices of the correct option(s) within proposedOptions> ]
                  }
                }

                When building "issues", flag: ambiguous wording, multiple defensible correct answers,
                weak or implausible distractors, grammar problems, and any factual doubt. If there are no
                issues, return an empty array.

                For "answerCheck": determine the genuinely correct answer.
                - If the marked answer is WRONG but the correct answer IS one of the listed options, set
                  correctAnswerInOptions=true, currentAnswerCorrect=false, and return proposedOptions as the
                  SAME options with proposedCorrectIndices pointing to the right one(s).
                - If the correct answer is NOT among the options, set correctAnswerInOptions=false and return
                  proposedOptions as a corrected full set of 4 options (fixing/replacing as needed) with
                  proposedCorrectIndices marking the correct one(s).
                - If the question is already correct, set both booleans true and return proposedOptions as [].
                Always keep proposedOptions to 4 concise options when you provide them.
                """.formatted(
                q.getQuestionStem() == null ? "" : q.getQuestionStem(),
                options.toString(),
                q.getDifficulty() == null ? "UNKNOWN" : q.getDifficulty().name());
    }

    /** Extracts the first {@code {} … {}} JSON object from arbitrary model text; null if none. */
    private String extractJsonObject(String text) {
        if (text == null) {
            return null;
        }
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start == -1 || end == -1 || end < start) {
            return null;
        }
        return text.substring(start, end + 1);
    }

    // ------------------------------------------------------------------
    //  Heuristic fallback — deterministic, never throws
    // ------------------------------------------------------------------

    private AiReviewResponse heuristic(McqQuestion q) {
        String stem = q.getQuestionStem() == null ? "" : q.getQuestionStem().trim();
        List<String> opts = q.getOptions() == null ? List.of() : q.getOptions();
        List<Integer> correct = q.getCorrectOptionIndices() == null ? List.of() : q.getCorrectOptionIndices();

        int score = 50;
        List<Issue> issues = new ArrayList<>();

        // Stem length
        if (stem.length() >= 20) {
            score += 15;
        } else {
            score -= 15;
            issues.add(new Issue("WARNING", "Question stem is very short (< 20 characters); add more context."));
        }

        // Option count
        if (opts.size() >= 4) {
            score += 15;
        } else {
            score -= 10;
            issues.add(new Issue("WARNING",
                    "Only " + opts.size() + " option(s); 4 plausible options are recommended."));
        }

        // Exactly one correct
        if (correct.size() == 1) {
            score += 20;
        } else if (correct.isEmpty()) {
            score -= 25;
            issues.add(new Issue("CRITICAL", "No correct option is marked."));
        } else {
            score -= 5;
            issues.add(new Issue("WARNING",
                    correct.size() + " options are marked correct; confirm this is intended (multiple defensible answers)."));
        }

        // Blank options
        boolean hasBlank = opts.stream().anyMatch(o -> o == null || o.isBlank());
        if (hasBlank) {
            score -= 10;
            issues.add(new Issue("WARNING", "One or more options are blank."));
        }

        score = clampScore(score);

        String difficulty = q.getDifficulty() == null ? "MEDIUM" : q.getDifficulty().name();

        List<String> suggestions = new ArrayList<>();
        suggestions.add("Re-read each distractor to ensure it is plausible but clearly incorrect.");
        suggestions.add("Check the stem for ambiguous wording and grammar.");
        if (opts.size() < 4) {
            suggestions.add("Add more options so there are at least four choices.");
        }

        return new AiReviewResponse(score, difficulty, "Heuristic quality estimate (AI unavailable).",
                issues, heuristicExplanation(q), suggestions, false, heuristicAnswerCheck(q));
    }

    private String heuristicExplanation(McqQuestion q) {
        List<String> opts = q.getOptions() == null ? List.of() : q.getOptions();
        List<Integer> correct = q.getCorrectOptionIndices() == null ? List.of() : q.getCorrectOptionIndices();
        if (correct.isEmpty()) {
            return "No correct option is marked for this question.";
        }
        List<String> letters = new ArrayList<>();
        for (Integer i : correct) {
            if (i != null && i >= 0 && i < opts.size()) {
                letters.add(String.valueOf((char) ('A' + i)));
            }
        }
        String joined = String.join(", ", letters);
        return correct.size() == 1
                ? "Option " + joined + " is marked as the correct answer."
                : "Options " + joined + " are marked as correct answers.";
    }

    /** Parse the model's answerCheck; only surfaces a proposed fix when it's coherent. */
    private AiReviewResponse.AnswerCheck parseAnswerCheck(JsonNode ac, McqQuestion q) {
        if (ac == null || !ac.isObject()) {
            return heuristicAnswerCheck(q);
        }
        boolean inOptions = ac.path("correctAnswerInOptions").asBoolean(true);
        boolean currentCorrect = ac.path("currentAnswerCorrect").asBoolean(true);
        String text = ac.path("correctAnswerText").asText("").trim();
        if (text.isBlank()) {
            text = heuristicExplanation(q);
        }

        List<String> proposed = new ArrayList<>();
        JsonNode po = ac.path("proposedOptions");
        if (po.isArray()) {
            for (JsonNode o : po) {
                String t = o.asText("").trim();
                if (!t.isBlank()) {
                    proposed.add(t);
                }
            }
        }
        List<Integer> idx = new ArrayList<>();
        JsonNode pi = ac.path("proposedCorrectIndices");
        if (pi.isArray()) {
            for (JsonNode n : pi) {
                int v = n.asInt(-1);
                if (v >= 0 && v < proposed.size() && !idx.contains(v)) {
                    idx.add(v);
                }
            }
        }
        // Only surface a proposed fix when it's coherent (>= 2 options and >= 1 correct index).
        if (proposed.size() < 2 || idx.isEmpty()) {
            proposed = List.of();
            idx = List.of();
        }
        return new AiReviewResponse.AnswerCheck(inOptions, currentCorrect, text, proposed, idx);
    }

    /** Heuristic answer-check (AI unavailable): never fabricates a fix. */
    private AiReviewResponse.AnswerCheck heuristicAnswerCheck(McqQuestion q) {
        List<Integer> correct = q.getCorrectOptionIndices() == null ? List.of() : q.getCorrectOptionIndices();
        boolean inOptions = !correct.isEmpty();
        return new AiReviewResponse.AnswerCheck(
                inOptions, inOptions, heuristicExplanation(q), List.of(), List.of());
    }

    // ------------------------------------------------------------------
    //  Helpers
    // ------------------------------------------------------------------

    private int clampScore(int score) {
        return Math.max(0, Math.min(100, score));
    }

    private String normalizeDifficulty(String value, McqQuestion q) {
        if (value != null) {
            String upper = value.trim().toUpperCase();
            if (upper.equals("EASY") || upper.equals("MEDIUM") || upper.equals("HARD")) {
                return upper;
            }
        }
        return q.getDifficulty() == null ? "MEDIUM" : q.getDifficulty().name();
    }

    private String normalizeSeverity(String value) {
        if (value != null) {
            String upper = value.trim().toUpperCase();
            if (upper.equals("INFO") || upper.equals("WARNING") || upper.equals("CRITICAL")) {
                return upper;
            }
        }
        return "INFO";
    }

    private String textOrDefault(JsonNode node, String fallback) {
        String value = node.asText("").trim();
        return value.isBlank() ? fallback : value;
    }
}
