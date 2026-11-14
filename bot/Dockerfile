FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

FROM node:22-alpine AS runner

LABEL org.opencontainers.image.title="mlbbdex-bot" \
      org.opencontainers.image.description="MLBBDex Discord bot: heroes, builds, counters, tier lists and daily games from mlbbdex.com." \
      org.opencontainers.image.source="https://github.com/achedon12/mlbb" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

# The internal server listens on the container's interface; the port is only
# reachable on the compose network, never published on the host.
ENV NODE_ENV=production \
    BOT_HTTP_HOST=0.0.0.0 \
    BOT_HTTP_PORT=3100

# Every shard is its own Node process and inherits this: the bot's working
# set is a few caches of game data, far below V8's default heap sizing,
# which grows with the host's RAM rather than with the need.
ENV NODE_OPTIONS=--max-old-space-size=192

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# The built-in `node` user; the image writes nothing at run time (logs go to
# stdout), so the container can run with a read-only root filesystem.
USER node

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.BOT_HTTP_PORT||3100)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

STOPSIGNAL SIGTERM
CMD ["node", "dist/index.js"]
