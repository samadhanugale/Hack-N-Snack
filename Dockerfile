# syntax=docker/dockerfile:1
#
# Smart Quiz AI Hub — single all-in-one image.
#
# One image, one command, everything inside: PostgreSQL + Spring Boot backend
# + Angular frontend (served by nginx), wired together and managed by
# supervisord. Runs fully offline (no external services, AI uses the built-in
# offline fallbacks). Cross-platform (Linux / macOS / Windows via Docker).
#
#   docker build -t smart-quiz-hub .
#   docker run --rm -p 4200:4200 -p 8080:8080 smart-quiz-hub
#   → open http://localhost:4200
#
# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — build the Spring Boot jar
# ─────────────────────────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21 AS backend-build
WORKDIR /src
# Resolve dependencies first so they cache independently of source changes.
COPY smart-quiz-hub-backend/pom.xml ./pom.xml
RUN mvn -B -q dependency:go-offline
COPY smart-quiz-hub-backend/src ./src
RUN mvn -B -q -DskipTests clean package && cp target/*.jar /app.jar

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — build the Angular frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS frontend-build
WORKDIR /fe
COPY smart-quiz-hub-frontend/package.json smart-quiz-hub-frontend/package-lock.json ./
# `npm install` (not `npm ci`): the committed lockfile omits some platform-only
# optional deps (@emnapi/*) and was written by a newer npm than the base image
# ships, which would make the strict `npm ci` fail. install reconciles it.
RUN npm install --no-audit --no-fund
COPY smart-quiz-hub-frontend/ ./
# Production build; output lands in dist/smart-quiz-hub-frontend/browser
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — runtime: PostgreSQL + JRE + nginx + supervisord
# ─────────────────────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-jammy AS runtime
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql postgresql-contrib nginx supervisor ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* \
 # drop the default cluster created by the postgres package; we manage our own
 && rm -rf /var/lib/postgresql/*/main \
 # remove the default nginx site so our config is the only server block
 && rm -f /etc/nginx/sites-enabled/default

WORKDIR /app

# Artifacts from the build stages
COPY --from=backend-build /app.jar /app/app.jar
COPY --from=frontend-build /fe/dist/smart-quiz-hub-frontend/browser/ /usr/share/nginx/html/

# Service configuration + process scripts
COPY docker/nginx.conf            /etc/nginx/nginx.conf
COPY docker/supervisord.conf      /etc/supervisor/conf.d/supervisord.conf
COPY docker/entrypoint.sh         /usr/local/bin/entrypoint.sh
COPY docker/run-postgres.sh       /usr/local/bin/run-postgres.sh
COPY docker/wait-for-postgres.sh  /usr/local/bin/wait-for-postgres.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
             /usr/local/bin/run-postgres.sh \
             /usr/local/bin/wait-for-postgres.sh \
 && mkdir -p /var/lib/postgresql/data \
 && chown -R postgres:postgres /var/lib/postgresql

# 4200 = frontend (nginx), 8080 = backend API
EXPOSE 4200 8080

# Basic liveness: backend health + frontend index both respond
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=10 \
  CMD curl -fsS http://localhost:8080/api/actuator/health \
   && curl -fsS http://localhost:4200/ -o /dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
