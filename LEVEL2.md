# Level 2 — AI Question Generation & Duplicate Detection

This builds on the Level 1 *Smart Quiz AI Hub* (Spring Boot backend + Angular frontend)
and adds two AI-driven capabilities, available to **both SMEs and Admins**:

1. **AI-Powered Question Generation** — generate MCQs for a chosen stack / topic /
   difficulty. Each generated question is screened for duplicates *during* generation;
   anything at or above the similarity threshold is discarded and regenerated, so the
   batch that lands in **My Questions** (as `DRAFT`) is internally unique and unique
   against the existing bank.
2. **AI Duplicate Detection** — a candidate MCQ is compared against existing questions
   in the **same stack + topic**. It runs in three places:
   - automatically during AI generation (above);
   - on demand via the **Duplicate Check** button on the Add/Edit question form;
   - automatically on **Save & Send for Review** — a question can only move to review
     when it is **below** the threshold, and the error lists the colliding questions.

The duplicate threshold is **30%** by default.

---

## How similarity is computed

Spring AI is used for both generation and similarity. Similarity has a primary path and
a deterministic fallback so the feature works with or without model credentials:

- **Embeddings (primary):** the question text (stem + four options) is embedded via Spring
  AI's `EmbeddingModel`; similarity is the cosine of the vectors. Because the cosine of
  unrelated English text sits well above zero, the raw cosine is rescaled from
  `[floor, 1]` to `[0, 1]` so the 30% threshold stays intuitive.
- **Lexical (fallback):** if no embedding model is configured or a call fails, a
  deterministic scorer is used — a blend of term-frequency cosine (0.7) and Jaccard token
  overlap (0.3) over normalised, stop-word-filtered tokens. It is already in a natural
  0–1 range.

Both paths produce a 0–1 score that is turned into a percentage and compared to the
threshold, so behaviour is consistent regardless of which path runs.

**Denoising.** Every question being compared lives in the same stack + topic, so the
stack/topic name tokens are constant and carry no “is this a duplicate” signal. Those
tokens are stripped before scoring; otherwise a long topic name would inflate the score
of every pair and cause false positives.

**Intra-batch de-duplication during generation** relies on the fact that each accepted
question is saved immediately (the entity uses `IDENTITY` generation, so the row is
inserted at save time). The next candidate's similarity query therefore sees the
already-accepted members of the same batch — no separate bookkeeping needed.

**Offline generation.** When no chat model is configured, a deterministic local generator
produces mutually-distinct, topic-aware placeholder MCQs so generation still returns
results end-to-end. With credentials configured, the Spring AI chat model is used instead.

---

## New / changed API endpoints

All under the existing `/api` context path and require an authenticated SME or Admin.

| Method & path              | Purpose                                                            |
|----------------------------|--------------------------------------------------------------------|
| `POST /api/ai/generate`    | Generate MCQs (duplicates auto-screened); saved as `DRAFT`.        |
| `POST /api/ai/duplicate-check` | Check a candidate MCQ against the same stack + topic.          |

`POST /api/ai/generate` body:

```json
{ "stackId": 1, "topicId": 2, "difficulty": "MEDIUM", "topicContext": "circuit breakers", "count": 3 }
```

`POST /api/ai/duplicate-check` body (omit/null `excludeId` for a new question; set it to the
question's own id when editing so it isn't compared against itself):

```json
{ "stackId": 1, "topicId": 2, "questionStem": "...", "optionA": "...", "optionB": "...",
  "optionC": "...", "optionD": "...", "excludeId": 42 }
```

Response payload (`data`):

```json
{ "duplicate": true, "maxSimilarityPercent": 41.2, "thresholdPercent": 30,
  "similar": [ { "id": 7, "questionStem": "...", "stackName": "...", "topicName": "...",
                 "status": "APPROVED", "similarityPercent": 41.2 } ] }
```

When **Save & Send for Review** is blocked server-side, the API responds `409 Conflict`
with the same `maxSimilarityPercent` / `thresholdPercent` / `similar` detail in `data`.

> Note: the previous admin-only `POST /api/admin/ai/generate` has been removed; AI
> generation now lives under `/api/ai` and is available to SMEs and Admins alike.

---

## Configuration

Configured in `smart-quiz-hub-backend/src/main/resources/application.yml`, all overridable
via environment variables:

| Env var                  | Default               | Meaning                                                        |
|--------------------------|-----------------------|----------------------------------------------------------------|
| `OPENAI_API_KEY`         | `dummy-key-...`       | Spring AI credential. Without a real key the offline fallbacks run. |
| `AI_SIMILARITY_THRESHOLD`| `0.30`                | Duplicate threshold (0–1). `0.30` = 30%.                       |
| `AI_EMBEDDINGS_ENABLED`  | `true`                | Use embeddings for similarity; on any failure it falls back to lexical. |
| `AI_EMBEDDING_FLOOR`     | `0.50`                | Lower bound used to rescale embedding cosine into 0–1.         |

The embedding model is `text-embedding-3-small` (`spring.ai.openai.embedding.options.model`).

To run fully offline, simply leave `OPENAI_API_KEY` unset — generation uses the local
generator and similarity uses the lexical scorer. To use real AI, export a valid
`OPENAI_API_KEY` before starting the backend.

---

## Running

Backend (from `smart-quiz-hub-backend`, requires a running Postgres as per Level 1):

```bash
# optional: export OPENAI_API_KEY=sk-...        # omit to run offline
# optional: export AI_SIMILARITY_THRESHOLD=0.30
mvn spring-boot:run
```

Frontend (from `smart-quiz-hub-frontend`):

```bash
npm install
ng serve
```

Then sign in (seed users from Level 1, e.g. password `Admin@123`), open **My Questions →
Add Question**, and try **Generate with AI**, or open any draft and use **Duplicate Check**
and **Save & Send for Review**.

---

## Where the Level 2 code lives

**Backend** (`com.accenture.smartquiz`)
- `service/SimilarityService` + `service/impl/SimilarityServiceImpl` — embeddings + lexical
  similarity, denoising, threshold.
- `service/SimilarityOutcome` — internal result carrying entity matches + scores.
- `service/impl/AiQuestionServiceImpl` — generation with per-candidate screening,
  regeneration, and the offline fallback generator.
- `controller/AiController` — `/ai/generate` and `/ai/duplicate-check`.
- `service/impl/McqServiceImpl` — `checkDuplicate(...)` and threshold enforcement inside
  `submitForReview(...)`.
- `exception/DuplicateQuestionException` + `GlobalExceptionHandler` — `409` with detail.
- DTOs: `request/DuplicateCheckRequest`, `response/DuplicateCheckResponse`,
  `response/SimilarQuestionResponse`; `util/McqMapper` helpers; `application.yml` config.

**Frontend** (`src/app`)
- `core/services/ai.service.ts` — `generate()` / `duplicateCheck()`.
- `core/models/index.ts` — duplicate-check models.
- `features/questions/ai-generate-dialog/` — shared “Generate with AI” dialog.
- `features/questions/my-questions/` — “Add Question” menu (Add from UI / Bulk Upload /
  Generate with AI).
- `features/questions/question-form/` — “Duplicate Check” button, results panel, and
  submit-time enforcement.
