# Running Smart Quiz AI Hub in Docker (fully offline)

One image contains everything — **PostgreSQL + Spring Boot backend + Angular
frontend** — wired together and started for you. No host PostgreSQL, no Node,
no JDK required; just Docker. Works the same on **Linux, macOS, and Windows**.

The app runs **fully offline**: no external network calls at runtime. AI
generation and duplicate detection use the built-in offline fallbacks (local
MCQ generator + deterministic lexical similarity). *(The image **build** does
download Maven/npm dependencies once; running it afterwards needs no network.)*

---

## Quick start

### Option A — Docker Compose (recommended)

```bash
docker compose up --build
```

Then open **http://localhost:4200**.

The database lives on a named volume (`pgdata`), so your data survives
`docker compose restart` / `up` / `down`. To wipe it and start fresh:

```bash
docker compose down -v
```

### Option B — plain Docker

```bash
docker build -t smart-quiz-hub .
docker run --rm -p 4200:4200 smart-quiz-hub
```

Then open **http://localhost:4200**.

> Only one port is published. The UI **and** the API are served from it; nginx
> proxies `/api` to the backend inside the container. (Compose/`APP_PORT` is the
> easy way to change it.)

---

## What's inside / how it's wired

| Port | Service                      | Published? | Notes                              |
|------|------------------------------|------------|------------------------------------|
| 4200 | Angular UI + `/api` proxy (nginx) | ✅ yes (`APP_PORT`) | SPA + reverse-proxy to backend |
| 8080 | Spring Boot API (`/api`)     | ❌ internal | reached via the nginx `/api` proxy |
| 5432 | PostgreSQL                   | ❌ internal | Flyway migrates + seeds on first boot |

Startup order is handled automatically: `supervisord` launches PostgreSQL,
the backend waits for the database to accept connections before starting
(Flyway then creates and seeds the schema), and nginx serves the prebuilt UI.

The first boot initialises the database and runs the Flyway migration, which
**seeds the demo users, stacks, and topics** — so you can log in immediately.

## Sign in

Password for all seeded users: **`Admin@123`**. Log in with the **Enterprise
ID** (not email):

| Enterprise ID         | Role  |
|-----------------------|-------|
| `admin.user`          | ADMIN |
| `gaurav.a.bhola`      | SME   |
| `birendra.kumar.singh`| SME   |
| `divya.madhanasekar`  | SME   |
| `swati.avinash.nikam` | SME   |
| `indugu.hari.prasad`  | SME   |

## Configuration — all via `.env`

Every operator setting lives in **`.env`** (copy it from `.env.example`).
`docker-compose.yml` reads it, with safe defaults baked in, so editing `.env`
is the only thing you touch. After a change: `docker compose up -d`.

| Variable                  | Default      | Meaning                                              |
|---------------------------|--------------|------------------------------------------------------|
| `APP_PORT`                | `4200`       | Host port for the UI **and** API (same origin).      |
| `OPENAI_API_KEY`          | _(blank)_    | Real key enables AI; blank → offline fallbacks.      |
| `AI_SIMILARITY_THRESHOLD` | `0.30`       | Duplicate threshold, 0–1 (0.30 = 30%).               |
| `AI_EMBEDDINGS_ENABLED`   | `true`       | Use AI embeddings (auto-falls back to lexical).      |
| `AI_EMBEDDING_FLOOR`      | `0.50`       | Advanced: embedding-cosine rescale floor.            |
| `JWT_SECRET`              | _(dev key)_  | Change for any shared/real deployment.               |
| `JWT_EXPIRATION_MS`       | `86400000`   | Login lifetime in ms (24h).                          |
| `DB_PASSWORD`             | `root`       | Internal DB password; applied only on a fresh DB.    |

```bash
# example: run on port 9000 with a real key
printf 'APP_PORT=9000\nOPENAI_API_KEY=sk-...\n' >> .env
docker compose up -d
```

> **Single port:** the UI and the `/api` backend are served from the same port
> (nginx reverse-proxies `/api` to the backend internally), so changing
> `APP_PORT` needs no other change — no CORS edits, no rebuild. Port 8080 is
> internal to the container and is not published.

## Troubleshooting

- **Port already in use** — change `APP_PORT` in `.env`, then `docker compose up -d`.
- **Changed `DB_PASSWORD` and login/DB breaks?** It only applies to a brand-new
  database. Reset with `docker compose down -v` (erases data) then `up`.
- **Container logs** — `docker compose logs -f` (or `docker logs -f smart-quiz-hub`).
- **Healthcheck** — `docker ps` shows `healthy` once the API + UI respond
  (allow ~60–90s on first boot).
