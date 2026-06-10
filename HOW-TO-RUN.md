# How to Run Smart Quiz AI Hub — Simple Guide

This guide gets the whole app running from the **terminal only**. No coding,
no clicking around. If you can copy-paste, you can run this. 🙂

---

## 1. What you need (infrastructure)

**You only install ONE thing: Docker.**

Everything the app needs is already packed inside a single Docker "image":

| Part        | What it is                         | You install it? |
|-------------|------------------------------------|-----------------|
| Database    | PostgreSQL (stores the data)       | ❌ No — built in |
| Backend     | Java / Spring Boot API (port 8080) | ❌ No — built in |
| Website     | Angular site via nginx (port 4200) | ❌ No — built in |
| **Docker**  | Runs all of the above together     | ✅ **Yes**       |

So: **no Java, no Node, no database to set up by hand.** Docker does it all.

> The app runs **fully offline** — once the image is built it needs no internet.

### Check Docker is installed

Open a terminal and run:

```bash
docker --version
docker compose version
```

If both print a version number, you're ready. If not, install Docker first:
https://docs.docker.com/get-docker/  (Linux, macOS, and Windows all supported).

---

## 2. Run the app (this is the whole thing)

**Step 1** — go to the project folder:

```bash
cd /home/beingatushar/Downloads/Hack-N-Stack-Level2
```

**Step 2** — start everything with one command:

```bash
docker compose up --build
```

The **first time** this takes a few minutes (it’s building the database,
backend, and website). You’ll see lots of log text scroll by — that’s normal.
It’s ready when the scrolling slows down and you see lines like
`Started SmartQuizAiHubApplication`.

**Step 3** — open the website in your browser:

👉 **http://localhost:4200**

That’s it. The app is running.

---

## 2b. Change settings — edit ONE file: `.env`

You don’t need to understand the app. All settings live in a file called
**`.env`** in the project folder. Open it in any text editor, change a value,
save, and restart (`docker compose up`). Common ones:

| In `.env`                 | What it does                                              |
|---------------------------|----------------------------------------------------------|
| `APP_PORT=4200`           | The port you open in the browser. Change if 4200 is busy. |
| `OPENAI_API_KEY=`         | Paste a real key to enable AI; leave blank to run offline.|
| `AI_SIMILARITY_THRESHOLD=0.30` | How strict duplicate detection is (0.30 = 30%).      |
| `JWT_EXPIRATION_MS=86400000` | How long a login lasts (in ms; 86400000 = 24h).       |
| `DB_PASSWORD=root`        | Internal database password (advanced).                    |

If there’s no `.env` yet, create it by copying the template:

```bash
cp .env.example .env
```

(No `.env` at all? It still runs — the defaults above are built in.)
After editing `.env`, apply it with:

```bash
docker compose up -d
```

> Changing `APP_PORT` is safe — the website and its API are served on the same
> port, so nothing else needs adjusting.

---

## 3. Log in

On the login screen, use the **Enterprise ID** (it is *not* an email):

| Enterprise ID | Password    | Role  |
|---------------|-------------|-------|
| `admin.user`  | `Admin@123` | Admin |
| `gaurav.a.bhola` | `Admin@123` | SME |

---

## 4. Stop / start again

- **Stop it:** press **Ctrl + C** in the terminal where it’s running.
  (or, from the project folder in another terminal: `docker compose down`)

- **Start it again later** (no rebuild needed after the first time):

  ```bash
  docker compose up
  ```

- **Start fresh / wipe all data** (resets the database to seeded defaults):

  ```bash
  docker compose down -v
  docker compose up --build
  ```

---

## 5. Handy commands (cheat sheet)

```bash
docker ps                  # is it running? look for "smart-quiz-hub (healthy)"
docker compose logs -f     # watch the live logs (Ctrl+C to stop watching)
docker compose down        # stop and remove the app (data is kept)
docker compose down -v      # stop and ALSO erase the database
```

---

## 6. Troubleshooting

- **`permission denied ... docker daemon` (common on Linux):**
  Put `sudo` in front of the command and enter your computer’s password, e.g.
  `sudo docker compose up --build`.
  To avoid typing `sudo` every time, run this once, then log out and back in:
  ```bash
  sudo usermod -aG docker $USER
  ```

- **`port is already allocated` / `address already in use`:**
  The app (or something on port 4200/8080) is already running. Either just open
  http://localhost:4200, or stop it first with `docker compose down` and try again.

- **The page doesn’t load right after starting:**
  Give it ~30–60 seconds on first boot (the database initializes), then refresh.

- **Want to use real AI instead of the offline fallback?**
  Put your key in `.env` (`OPENAI_API_KEY=sk-your-key`), then `docker compose up -d`.

---

That’s everything. For more technical detail (ports, how it’s wired, config
options), see **DOCKER.md**.
