package com.accenture.smartquiz.service.impl;

import com.accenture.smartquiz.entity.McqQuestion;
import com.accenture.smartquiz.repository.McqQuestionRepository;
import com.accenture.smartquiz.service.SimilarityOutcome;
import com.accenture.smartquiz.service.SimilarityService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Semantic similarity using Spring AI embeddings with a deterministic lexical
 * fallback.
 *
 * <p>Scores are normalised to 0.0–1.0 so the same {@code 30%} threshold is
 * meaningful regardless of which path runs:</p>
 * <ul>
 *   <li><b>Embeddings:</b> cosine of the embedding vectors, then rescaled from
 *       {@code [floor, 1]} to {@code [0, 1]} (raw embedding cosine of unrelated
 *       English text sits well above zero, so a floor keeps percentages
 *       intuitive).</li>
 *   <li><b>Lexical fallback:</b> a blend of term-frequency cosine and Jaccard
 *       overlap over normalised tokens — already in a natural 0–1 range.</li>
 * </ul>
 */
@Service
@Slf4j
public class SimilarityServiceImpl implements SimilarityService {

    private static final Set<String> STOPWORDS = Set.of(
            "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
            "to", "of", "in", "on", "for", "and", "or", "but", "if", "then",
            "with", "without", "as", "at", "by", "from", "into", "that", "this",
            "these", "those", "it", "its", "he", "she", "they", "we", "you",
            "his", "her", "their", "which", "who", "whom", "what", "when",
            "where", "how", "why", "will", "would", "can", "could", "should",
            "do", "does", "did", "has", "have", "had", "not", "no", "yes",
            "want", "wants", "wanted", "using", "use", "used", "needs",
            "need", "needed", "him", "them", "build", "building"
    );

    private final ObjectProvider<EmbeddingModel> embeddingModelProvider;
    private final McqQuestionRepository mcqRepo;

    private final double threshold;
    private final boolean embeddingsEnabled;
    private final double embeddingFloor;

    public SimilarityServiceImpl(ObjectProvider<EmbeddingModel> embeddingModelProvider,
                                 McqQuestionRepository mcqRepo,
                                 @Value("${app.ai.similarity.threshold:0.30}") double threshold,
                                 @Value("${app.ai.similarity.embeddings-enabled:true}") boolean embeddingsEnabled,
                                 @Value("${app.ai.similarity.embedding-floor:0.50}") double embeddingFloor) {
        this.embeddingModelProvider = embeddingModelProvider;
        this.mcqRepo = mcqRepo;
        this.threshold = threshold;
        this.embeddingsEnabled = embeddingsEnabled;
        this.embeddingFloor = embeddingFloor;
    }

    @Override
    public double threshold() {
        return threshold;
    }

    @Override
    @Transactional(readOnly = true)
    public SimilarityOutcome analyze(Long stackId, Long topicId,
                                     String questionStem,
                                     String optionA, String optionB, String optionC, String optionD,
                                     Long excludeId) {

        List<McqQuestion> existing = mcqRepo.findByStackIdAndTopicId(stackId, topicId).stream()
                .filter(q -> excludeId == null || !q.getId().equals(excludeId))
                .toList();

        if (existing.isEmpty()) {
            return SimilarityOutcome.empty();
        }

        String candidate = combine(questionStem, optionA, optionB, optionC, optionD);
        List<String> existingTexts = existing.stream()
                .map(q -> combine(q.getQuestionStem(), q.getOptionA(), q.getOptionB(),
                        q.getOptionC(), q.getOptionD()))
                .toList();

        // The topic and stack names are constant across every question in this
        // comparison set, so their tokens carry no duplicate signal — strip them
        // so similarity reflects the question-specific content only.
        Set<String> noise = new HashSet<>(tokenize(existing.get(0).getTopic().getTopicName()));
        noise.addAll(tokenize(existing.get(0).getStack().getStackName()));

        String candidateClean = denoise(candidate, noise);
        List<String> existingClean = existingTexts.stream().map(t -> denoise(t, noise)).toList();

        double[] scores = scoreAgainst(candidateClean, existingClean);

        List<SimilarityOutcome.Match> matches = new ArrayList<>(existing.size());
        double max = 0.0;
        for (int i = 0; i < existing.size(); i++) {
            double s = clamp01(scores[i]);
            matches.add(new SimilarityOutcome.Match(existing.get(i), s));
            max = Math.max(max, s);
        }
        matches.sort(Comparator.comparingDouble(SimilarityOutcome.Match::score).reversed());

        return new SimilarityOutcome(max, matches);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Scoring strategy
    // ──────────────────────────────────────────────────────────────────

    /** Try embeddings first; on any problem, fall back to the lexical scorer. */
    private double[] scoreAgainst(String candidate, List<String> existingTexts) {
        if (embeddingsEnabled) {
            double[] viaEmbeddings = tryEmbeddingScores(candidate, existingTexts);
            if (viaEmbeddings != null) {
                return viaEmbeddings;
            }
            log.debug("Embedding similarity unavailable — using lexical fallback for {} comparison(s)",
                    existingTexts.size());
        }
        double[] scores = new double[existingTexts.size()];
        for (int i = 0; i < existingTexts.size(); i++) {
            scores[i] = lexicalScore(candidate, existingTexts.get(i));
        }
        return scores;
    }

    /** @return normalised scores, or {@code null} to signal that the caller should fall back. */
    private double[] tryEmbeddingScores(String candidate, List<String> existingTexts) {
        EmbeddingModel model = embeddingModelProvider.getIfAvailable();
        if (model == null) {
            return null;
        }
        try {
            List<String> all = new ArrayList<>(existingTexts.size() + 1);
            all.add(candidate);
            all.addAll(existingTexts);

            List<float[]> vectors = model.embed(all);
            if (vectors == null || vectors.size() != all.size()) {
                return null;
            }

            float[] candidateVec = vectors.get(0);
            double[] scores = new double[existingTexts.size()];
            for (int i = 0; i < existingTexts.size(); i++) {
                double cos = cosine(candidateVec, vectors.get(i + 1));
                scores[i] = normaliseCosine(cos);
            }
            return scores;
        } catch (Exception ex) {
            log.warn("Embedding-based similarity failed ({}); falling back to lexical scorer",
                    ex.getMessage());
            return null;
        }
    }

    /** Rescale embedding cosine from [floor, 1] to [0, 1]. */
    private double normaliseCosine(double cos) {
        if (embeddingFloor >= 1.0) {
            return clamp01(cos);
        }
        return clamp01((cos - embeddingFloor) / (1.0 - embeddingFloor));
    }

    // ──────────────────────────────────────────────────────────────────
    //  Lexical scorer (deterministic, offline)
    // ──────────────────────────────────────────────────────────────────

    /** Blend of TF cosine (0.7) and Jaccard token overlap (0.3). */
    private double lexicalScore(String a, String b) {
        List<String> tokensA = tokenize(a);
        List<String> tokensB = tokenize(b);
        if (tokensA.isEmpty() || tokensB.isEmpty()) {
            return 0.0;
        }
        double cosine = tfCosine(tokensA, tokensB);
        double jaccard = jaccard(new HashSet<>(tokensA), new HashSet<>(tokensB));
        return 0.7 * cosine + 0.3 * jaccard;
    }

    private double tfCosine(List<String> a, List<String> b) {
        Map<String, Integer> fa = frequency(a);
        Map<String, Integer> fb = frequency(b);

        double dot = 0.0;
        for (Map.Entry<String, Integer> e : fa.entrySet()) {
            Integer other = fb.get(e.getKey());
            if (other != null) {
                dot += (double) e.getValue() * other;
            }
        }
        double normA = norm(fa.values());
        double normB = norm(fb.values());
        if (normA == 0.0 || normB == 0.0) {
            return 0.0;
        }
        return dot / (normA * normB);
    }

    private double jaccard(Set<String> a, Set<String> b) {
        Set<String> intersection = new HashSet<>(a);
        intersection.retainAll(b);
        Set<String> union = new HashSet<>(a);
        union.addAll(b);
        return union.isEmpty() ? 0.0 : (double) intersection.size() / union.size();
    }

    private Map<String, Integer> frequency(List<String> tokens) {
        Map<String, Integer> freq = new HashMap<>();
        for (String t : tokens) {
            freq.merge(t, 1, Integer::sum);
        }
        return freq;
    }

    private double norm(java.util.Collection<Integer> counts) {
        double sum = 0.0;
        for (int c : counts) {
            sum += (double) c * c;
        }
        return Math.sqrt(sum);
    }

    private List<String> tokenize(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        String normalised = text.toLowerCase().replaceAll("[^a-z0-9 ]", " ");
        List<String> tokens = new ArrayList<>();
        for (String token : normalised.split("\\s+")) {
            if (token.length() >= 2 && !STOPWORDS.contains(token)) {
                tokens.add(token);
            }
        }
        return tokens;
    }

    /** Normalise to tokens, drop the supplied (topic/stack) tokens, and re-join. */
    private String denoise(String text, Set<String> extra) {
        List<String> kept = new ArrayList<>();
        for (String token : tokenize(text)) {
            if (!extra.contains(token)) {
                kept.add(token);
            }
        }
        return String.join(" ", kept);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Helpers
    // ──────────────────────────────────────────────────────────────────

    private static double cosine(float[] a, float[] b) {
        if (a == null || b == null || a.length != b.length) {
            return 0.0;
        }
        double dot = 0.0, normA = 0.0, normB = 0.0;
        for (int i = 0; i < a.length; i++) {
            dot += (double) a[i] * b[i];
            normA += (double) a[i] * a[i];
            normB += (double) b[i] * b[i];
        }
        if (normA == 0.0 || normB == 0.0) {
            return 0.0;
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    private static String combine(String stem, String a, String b, String c, String d) {
        return String.join(" ",
                safe(stem), safe(a), safe(b), safe(c), safe(d));
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }

    private static double clamp01(double v) {
        if (v < 0.0) return 0.0;
        if (v > 1.0) return 1.0;
        return v;
    }
}
