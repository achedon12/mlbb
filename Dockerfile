FROM node:22-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
# The install generates the database client (postinstall): it needs the schema.
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# The Prisma command line, alone, to apply the migrations when the container
# starts: the standalone server does not carry it, and the full node_modules
# would triple the image. Same version as the lock file.
FROM node:22-alpine AS migrate

WORKDIR /migrate
COPY package-lock.json /tmp/package-lock.json
RUN --mount=type=cache,target=/root/.npm \
    version=$(node -p "require('/tmp/package-lock.json').packages['node_modules/prisma'].version") \
 && echo '{"private":true}' > package.json \
 && npm install --no-audit --no-fund --no-save "prisma@$version" \
 && rm /tmp/package-lock.json
COPY prisma.config.ts ./
COPY prisma ./prisma

FROM node:22-alpine AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_MATOMO_URL
ARG NEXT_PUBLIC_MATOMO_SITE_ID
# Discord bot: public values only, inlined in the pages (the invite link, the
# "Add to Discord" button). Without them the bot pages are not built.
ARG NEXT_PUBLIC_DISCORD_CLIENT_ID
ARG NEXT_PUBLIC_DISCORD_INVITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_MATOMO_URL=$NEXT_PUBLIC_MATOMO_URL \
    NEXT_PUBLIC_MATOMO_SITE_ID=$NEXT_PUBLIC_MATOMO_SITE_ID \
    NEXT_PUBLIC_DISCORD_CLIENT_ID=$NEXT_PUBLIC_DISCORD_CLIENT_ID \
    NEXT_PUBLIC_DISCORD_INVITE_URL=$NEXT_PUBLIC_DISCORD_INVITE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

FROM node:22-alpine AS runner

LABEL org.opencontainers.image.title="mlbb" \
      org.opencontainers.image.description="Mobile Legends: Bang Bang knowledge base — heroes, builds, tier list and news." \
      org.opencontainers.image.source="https://github.com/achedon12/mlbb" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/donnees-serveur

# V8 sizes its heap from the host's RAM (4 GB on a 16 GB server) and only
# collects garbage seriously near that limit: the site sat at 5 GB in
# production for a working set of a few hundred MB. A 384 MB heap, measured
# fine locally on older data, ran out of memory in production every 2-4
# minutes (live set ~380 MB under real traffic and the current data): 1 GB
# leaves room for both to grow.
ENV NODE_OPTIONS=--max-old-space-size=1024

# The data folder exists in the image, owned by the user: a named volume
# mounted on it inherits that ownership when it is created.
RUN apk add --no-cache wget \
 && addgroup -g 1001 -S nodejs \
 && adduser -u 1001 -S nextjs -G nodejs \
 && mkdir -p /app/donnees-serveur \
 && chown nextjs:nodejs /app/donnees-serveur

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Owned by root: the user runs the migrations, it has no business editing them.
COPY --from=migrate /migrate ./migrate
COPY scripts/container-start.mjs ./container-start.mjs

USER nextjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

STOPSIGNAL SIGTERM
# Applies the pending database migrations when DATABASE_URL is set, then
# starts the server in the same process (it stays PID 1 and gets SIGTERM).
CMD ["node", "container-start.mjs"]
