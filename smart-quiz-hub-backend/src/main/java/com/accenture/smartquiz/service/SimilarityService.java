package com.accenture.smartquiz.service;

/**
 * AI-driven semantic similarity / duplicate detection (Level 2).
 *
 * <p>Primary scoring uses Spring AI embeddings (cosine similarity). When
 * embeddings are unavailable — e.g. no API key configured, or a network/API
 * error — the implementation transparently falls back to a deterministic
 * lexical scorer so the feature keeps working offline.</p>
 */
public interface SimilarityService {

    /**
     * Compare a candidate MCQ against every existing question in the same
     * technology stack <em>and</em> topic.
     *
     * @param excludeId optional id to exclude (the question being edited); may be {@code null}
     * @return the similarity outcome (max score + per-question matches, 0.0–1.0)
     */
    SimilarityOutcome analyze(Long stackId, Long topicId,
                              String questionStem,
                              String optionA, String optionB, String optionC, String optionD,
                              Long excludeId);

    /** The configured duplicate threshold in the range 0.0–1.0 (default 0.30). */
    double threshold();
}
