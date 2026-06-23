package com.accenture.smartquiz.service.impl;

import com.accenture.smartquiz.dto.request.AiGenerateRequest;
import com.accenture.smartquiz.dto.response.McqResponse;
import com.accenture.smartquiz.entity.McqQuestion;
import com.accenture.smartquiz.entity.TechnologyStack;
import com.accenture.smartquiz.entity.Topic;
import com.accenture.smartquiz.entity.User;
import com.accenture.smartquiz.entity.enums.Difficulty;
import com.accenture.smartquiz.entity.enums.McqStatus;
import com.accenture.smartquiz.exception.ResourceNotFoundException;
import com.accenture.smartquiz.repository.McqQuestionRepository;
import com.accenture.smartquiz.repository.TechnologyStackRepository;
import com.accenture.smartquiz.repository.TopicRepository;
import com.accenture.smartquiz.repository.UserRepository;
import com.accenture.smartquiz.security.SmartQuizUserDetails;
import com.accenture.smartquiz.service.AiQuestionService;
import com.accenture.smartquiz.service.SimilarityOutcome;
import com.accenture.smartquiz.service.SimilarityService;
import com.accenture.smartquiz.util.McqMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;

/**
 * AI-powered question generation (Level 2).
 *
 * <p>Each candidate is screened for duplication <em>during</em> generation:
 * if it is too similar (>= the configured threshold) to an existing question
 * in the same stack + topic, or to a question already accepted in this batch,
 * it is discarded and a fresh one is generated to replace it.</p>
 *
 * <p>When the Spring AI chat model is unavailable (e.g. no {@code OPENAI_API_KEY}),
 * a deterministic local generator supplies candidates so the feature still works
 * end-to-end offline.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiQuestionServiceImpl implements AiQuestionService {

    /** Hard ceiling on AI calls per request, to bound cost/latency. */
    private static final int MAX_AI_CALLS = 4;
    private final McqQuestionRepository mcqRepo;
    private final TechnologyStackRepository stackRepo;
    private final TopicRepository topicRepo;
    private final UserRepository userRepo;
    private final ObjectMapper objectMapper;
    private final SimilarityService similarityService;

    // Reuse the OpenAI-compatible config (Groq by default). We call the HTTP API directly
    // instead of via Spring AI's ChatClient — Spring AI 1.0.0-M3 fails to deserialize Groq's
    // response because it adds extra usage fields (queue_time, prompt_time, ...) the M3 DTOs reject.
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

    private final RestClient restClient = RestClient.create();

    @Override
    @Transactional
    public List<McqResponse> generateQuestions(AiGenerateRequest request, SmartQuizUserDetails currentUser) {
        TechnologyStack stack = stackRepo.findById(request.stackId())
                .orElseThrow(() -> new ResourceNotFoundException("TechnologyStack", request.stackId()));
        Topic topic = topicRepo.findById(request.topicId())
                .orElseThrow(() -> new ResourceNotFoundException("Topic", request.topicId()));
        User creator = userRepo.getReferenceById(currentUser.getUserId());

        final int target = Math.max(1, request.count());
        final double threshold = similarityService.threshold();

        List<McqQuestion> accepted = new ArrayList<>(target);

        Deque<Map<String, Object>> pool = new ArrayDeque<>();
        int aiCalls = 0;
        int fallbackCursor = 0;
        int safety = 0;
        final int maxSafety = target * 8 + 20;

        while (accepted.size() < target && safety < maxSafety) {
            safety++;

            if (pool.isEmpty()) {
                int need = (target - accepted.size()) + 2;
                if (aiCalls < MAX_AI_CALLS) {
                    aiCalls++;
                    List<Map<String, Object>> batch = callAi(buildPrompt(
                            stack.getStackName(), topic.getTopicName(),
                            request.difficulty().name(), request.topicContext(), need));
                    if (batch.isEmpty()) {
                        log.info("AI chat returned no candidates - using local fallback generator");
                        pool.addAll(fallbackCandidates(stack.getStackName(), topic.getTopicName(),
                                need, fallbackCursor));
                        fallbackCursor += need;
                        aiCalls = MAX_AI_CALLS; // don't keep retrying a failing model
                    } else {
                        pool.addAll(batch);
                    }
                } else {
                    pool.addAll(fallbackCandidates(stack.getStackName(), topic.getTopicName(),
                            need, fallbackCursor));
                    fallbackCursor += need;
                }
            }

            Map<String, Object> cand = pool.poll();
            if (cand == null) {
                continue;
            }

            McqQuestion candidate = toCandidate(cand, stack, topic, creator, request.difficulty());
            if (candidate == null) {
                continue; // malformed candidate - skip
            }

            double maxScore = screen(candidate);
            if (maxScore >= threshold) {
                log.debug("Discarding AI candidate - similarity {}% >= threshold {}%",
                        Math.round(maxScore * 100), Math.round(threshold * 100));
                continue; // replace with the next freshly generated candidate
            }

            candidate.setAiSimilarityScore(
                    BigDecimal.valueOf(maxScore).setScale(4, RoundingMode.HALF_UP));
            // Saved immediately so the next candidate is screened against it too
            // (JPA auto-flushes before the next similarity query in this transaction).
            McqQuestion saved = mcqRepo.save(candidate);
            accepted.add(saved);
        }

        if (accepted.size() < target) {
            log.warn("AI generation produced {} of {} requested question(s) after de-duplication",
                    accepted.size(), target);
        }

        return accepted.stream().map(McqMapper::toResponse).toList();
    }

    /** Max similarity of a candidate against existing questions in the same stack + topic. */
    private double screen(McqQuestion candidate) {
        SimilarityOutcome outcome = similarityService.analyze(
                candidate.getStack().getId(), candidate.getTopic().getId(),
                candidate.getQuestionStem(), candidate.getOptions(), null);
        return outcome.maxScore();
    }

    private McqQuestion toCandidate(Map<String, Object> q, TechnologyStack stack, Topic topic,
                                    User creator, Difficulty difficulty) {
        String stem = str(q, "question");
        String a = str(q, "optionA");
        String b = str(q, "optionB");
        String c = str(q, "optionC");
        String d = str(q, "optionD");
        String correct = str(q, "correctOption").toUpperCase();

        if (stem.isBlank() || a.isBlank() || b.isBlank() || c.isBlank() || d.isBlank()
                || !correct.matches("[ABCD]")) {
            return null;
        }

        // Map A/B/C/D letter to 0-based index
        int correctIndex = correct.charAt(0) - 'A';

        return McqQuestion.builder()
                .questionStem(stem)
                .options(List.of(a, b, c, d))
                .correctOptionIndices(List.of(correctIndex))
                .difficulty(difficulty)
                .stack(stack)
                .topic(topic)
                .creator(creator)
                .aiGenerated(true)
                .status(McqStatus.AI_PENDING)
                .build();
    }

    // ------------------------------------------------------------------
    //  Spring AI chat
    // ------------------------------------------------------------------

    private String buildPrompt(String stack, String topic, String difficulty,
                                String context, int count) {
        return """
                You are an expert Java/Spring educator creating MCQ questions for technical assessments.

                Generate exactly %d MCQ questions about "%s" in the context of "%s" technology stack.
                Difficulty: %s
                Additional context: %s

                Rules:
                - Each question must be scenario-based (start with a developer name and a real-world situation)
                - Make every question distinct from the others - vary the scenario, wording, and focus
                - Options must be plausible and educational
                - Only one correct answer per question

                Respond ONLY with a valid JSON array. No extra text. Format:
                [
                  {
                    "question": "...",
                    "optionA": "...",
                    "optionB": "...",
                    "optionC": "...",
                    "optionD": "...",
                    "correctOption": "A|B|C|D"
                  }
                ]
                """.formatted(count, topic, stack, difficulty, context);
    }

    /**
     * Calls the OpenAI-compatible chat completions endpoint directly via RestClient.
     * Parsing with Jackson's readTree tolerates any provider-specific extra fields
     * (e.g. Groq's queue_time/prompt_time), so it works across OpenAI, Groq, Ollama, etc.
     */
    private List<Map<String, Object>> callAi(String prompt) {
        try {
            Map<String, Object> requestBody = Map.of(
                    "model", model,
                    "temperature", temperature,
                    "max_tokens", maxTokens,
                    "messages", List.of(Map.of("role", "user", "content", prompt))
            );

            String responseBody = restClient.post()
                    .uri(baseUrl + "/v1/chat/completions")
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(String.class);

            JsonNode root = objectMapper.readTree(responseBody);
            String content = root.path("choices").path(0).path("message").path("content").asText();

            String json = extractJson(content);
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.error("AI question generation failed: {}", e.getMessage());
            return List.of();
        }
    }

    private String extractJson(String text) {
        if (text == null) {
            return "[]";
        }
        int start = text.indexOf('[');
        int end = text.lastIndexOf(']');
        if (start == -1 || end == -1 || end < start) {
            return "[]";
        }
        return text.substring(start, end + 1);
    }

    // ------------------------------------------------------------------
    //  Offline fallback generator
    //  Produces deterministic, mutually-distinct placeholder MCQs so the
    //  feature is demonstrable without an OPENAI_API_KEY. Real generation
    //  uses the Spring AI chat model above.
    // ------------------------------------------------------------------

    private static final String[] NAMES = {
            "Alex", "Maria", "John", "Priya", "Sam", "Nina",
            "Omar", "Lena", "Raj", "Eva", "Tom", "Zoe"
    };

    private List<Map<String, Object>> fallbackCandidates(String stack, String topic,
                                                         int count, int cursor) {
        List<Map<String, Object>> out = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            out.add(fallbackQuestion(stack, topic, cursor + i));
        }
        return out;
    }

    private Map<String, Object> fallbackQuestion(String stack, String topic, int idx) {
        String name = NAMES[idx % NAMES.length];
        int facet = idx % 10;

        String stem;
        String a, b, c, d, correct;

        switch (facet) {
            case 0 -> {
                stem = name + " is starting a project and wants to understand the core role of "
                        + topic + " within " + stack + ". What primarily describes its purpose?";
                a = "It provides the intended capability and abstractions for this concern";
                b = "It only formats console log output";
                c = "It is purely a build-time packaging tool";
                d = "It manages operating-system level threads exclusively";
                correct = "A";
            }
            case 1 -> {
                stem = name + " must decide when to apply " + topic + " in a " + stack
                        + " application. Which situation is the best fit?";
                a = "Whenever a class name happens to be long";
                b = "When the requirement matches what this concept is designed to solve";
                c = "Only inside unit tests and never in production";
                d = "Exclusively when the database is offline";
                correct = "B";
            }
            case 2 -> {
                stem = "While learning " + topic + ", " + name
                        + " keeps hitting a frequent beginner mistake. Which pitfall should be avoided?";
                a = "Reading the official reference documentation";
                b = "Writing small, focused examples first";
                c = "Ignoring configuration and assuming defaults always apply everywhere";
                d = "Validating behaviour with tests";
                correct = "C";
            }
            case 3 -> {
                stem = name + " is comparing " + topic + " against an alternative approach in " + stack
                        + ". Which statement captures the key distinction?";
                a = "Both are byte-for-byte identical in every way";
                b = "The alternative cannot run on any JVM";
                c = "They differ in the problem they target and how they are applied";
                d = "Neither can be configured at all";
                correct = "C";
            }
            case 4 -> {
                stem = name + " needs to set up " + topic + " correctly in a fresh " + stack
                        + " module. What is a sensible first configuration step?";
                a = "Delete the project and start in a different language";
                b = "Add and configure the relevant dependency or component, then verify it loads";
                c = "Disable all logging permanently";
                d = "Hard-code every value with no externalisation";
                correct = "B";
            }
            case 5 -> {
                stem = "A feature using " + topic + " fails at runtime for " + name
                        + ". What is the most reasonable troubleshooting move?";
                a = "Assume the framework is broken and stop investigating";
                b = "Randomly change unrelated files until something works";
                c = "Inspect the error, check configuration, and isolate the failing piece";
                d = "Remove all error handling so exceptions are hidden";
                correct = "C";
            }
            case 6 -> {
                stem = name + " is reviewing performance of code that relies on " + topic + " in " + stack
                        + ". Which consideration is most relevant?";
                a = "Choosing variable names that look fast";
                b = "Understanding the cost of the operation and avoiding needless repetition";
                c = "Always disabling the feature in production";
                d = "Adding more comments to speed up execution";
                correct = "B";
            }
            case 7 -> {
                stem = "Order of operations matters when " + name + " works with " + topic + ". "
                        + "Which sequence is conceptually correct?";
                a = "Use the result before anything is initialised";
                b = "Initialise or configure first, then use, then release or finalise as needed";
                c = "Finalise before configuring";
                d = "Skip initialisation entirely in every case";
                correct = "B";
            }
            case 8 -> {
                stem = name + " sees an annotation or keyword associated with " + topic
                        + " in a " + stack + " codebase. What is its general intent?";
                a = "To declare or wire the intended behaviour for the framework to apply";
                b = "To rename the source file at compile time";
                c = "To permanently disable the surrounding class";
                d = "To convert Java into a scripting language";
                correct = "A";
            }
            default -> {
                stem = name + " must choose the right tool for a real-world task and is weighing "
                        + topic + " in " + stack + ". Which factor should drive the decision?";
                a = "The colour of the IDE theme";
                b = "Whether the tool fits the requirement and constraints at hand";
                c = "The number of letters in the class name";
                d = "Personal preference for unrelated libraries";
                correct = "B";
            }
        }

        return Map.of(
                "question", stem,
                "optionA", a,
                "optionB", b,
                "optionC", c,
                "optionD", d,
                "correctOption", correct  // A/B/C/D — toCandidate maps this to an index
        );
    }

    // ------------------------------------------------------------------
    //  Helpers
    // ------------------------------------------------------------------

    private static String str(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value == null ? "" : value.toString().trim();
    }
}
