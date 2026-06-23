package com.accenture.smartquiz.entity.enums;

import java.util.Set;

/**
 * Question lifecycle state machine (Epic 1).
 *
 * <pre>
 *   DRAFT ─────────────► READY_FOR_REVIEW ◄────────────┐
 *                              │                        │
 *                              ▼                        │
 *                        UNDER_REVIEW                   │ (creator edits & resubmits)
 *               ┌──────────────┼──────────────┐        │
 *               ▼              ▼               ▼        │
 *          APPROVED       REJECTED   MODIFICATION_REQUESTED
 *          (terminal)    (terminal)          │          │
 *                                            └──────────┘
 * </pre>
 *
 * REJECTED and APPROVED are terminal — {@link #allowedTransitions()} is empty.
 * MODIFICATION_REQUESTED is the "suggest modifications" state: the creator may edit and
 * resubmit, which transitions back to READY_FOR_REVIEW.
 */
public enum McqStatus {

    /**
     * Freshly AI-generated question awaiting the creator's review. It is quarantined
     * out of the normal draft list until the creator <b>accepts</b> it (→ DRAFT) or
     * rejects it (deleted). Cannot be submitted for review while in this state.
     */
    AI_PENDING {
        @Override
        public Set<McqStatus> allowedTransitions() {
            return Set.of(DRAFT);
        }
    },
    DRAFT {
        @Override
        public Set<McqStatus> allowedTransitions() {
            return Set.of(READY_FOR_REVIEW);
        }
    },
    READY_FOR_REVIEW {
        @Override
        public Set<McqStatus> allowedTransitions() {
            return Set.of(UNDER_REVIEW, DRAFT);
        }
    },
    UNDER_REVIEW {
        @Override
        public Set<McqStatus> allowedTransitions() {
            return Set.of(APPROVED, REJECTED, MODIFICATION_REQUESTED, DRAFT);
        }
    },
    MODIFICATION_REQUESTED {
        @Override
        public Set<McqStatus> allowedTransitions() {
            return Set.of(READY_FOR_REVIEW, DRAFT);
        }
    },
    APPROVED {
        @Override
        public Set<McqStatus> allowedTransitions() {
            return Set.of();
        }
    },
    REJECTED {
        @Override
        public Set<McqStatus> allowedTransitions() {
            return Set.of();
        }
    };

    public abstract Set<McqStatus> allowedTransitions();

    public boolean canTransitionTo(McqStatus target) {
        return allowedTransitions().contains(target);
    }

    /** A terminal state can never transition further (APPROVED, REJECTED). */
    public boolean isTerminal() {
        return allowedTransitions().isEmpty();
    }
}
