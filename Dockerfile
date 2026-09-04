# syntax=docker/dockerfile:1
#
# Multi-stage build for running Fieldbook on a home server. Not used for local
# dev — keep using `bun run dev` for hot reload; see README "Running on a
# home server" for how the port and data volume are configured.

FROM node:24-bookworm-slim AS builder
WORKDIR /app

# better-sqlite3 downloads a prebuilt binary when one matches this image's
# platform/libc, and falls back to compiling from source otherwise — keep the
# toolchain around for that fallback. Debian glibc (not Alpine/musl) is used
# throughout so the native binding built here is guaranteed to match the
# runtime stage below.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates curl unzip \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Reinstall without devDependencies (eslint, vitest, typescript, Tailwind
# tooling) — next build already emitted static output, so the runtime image
# only needs what `next start` actually loads at request time.
RUN rm -rf node_modules && bun install --frozen-lockfile --production

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js

EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
