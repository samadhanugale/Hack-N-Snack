package com.accenture.smartquiz.service;

import com.accenture.smartquiz.entity.McqQuestion;

import java.util.List;

/**
 * Internal (non-DTO) result of a similarity analysis. Carries the entity
 * matches so callers running inside a transaction can map whatever fields they
 * need (stack/topic names, status, etc.).
 *
 * @param maxScore highest similarity score in the range 0.0–1.0 (0 when nothing to compare against)
 * @param matches  every compared question with its score, sorted highest first
 */
public record SimilarityOutcome(double maxScore, List<Match> matches) {

    public record Match(McqQuestion question, double score) {}

    public static SimilarityOutcome empty() {
        return new SimilarityOutcome(0.0, List.of());
    }

    /** Matches whose score reaches the given threshold (0.0–1.0), highest first. */
    public List<Match> matchesAtOrAbove(double threshold) {
        return matches.stream().filter(m -> m.score() >= threshold).toList();
    }
}
