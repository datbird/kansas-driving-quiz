# Kansas driving quiz — small Node image. better-sqlite3 uses a prebuilt binary
# when available; build tools are present in the builder stage as a fallback.
FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

FROM node:20-bookworm-slim
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    DB_PATH=/data/quiz.db
# ADMIN_EMAILS (and optionally SEED_USERS) are supplied at runtime, not baked in.
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY package.json server.js seed.js ./
COPY data ./data
COPY public ./public
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=4s --start-period=8s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Seed/migrate the DB on every start (idempotent), then serve.
CMD ["sh","-c","node seed.js && node server.js"]
