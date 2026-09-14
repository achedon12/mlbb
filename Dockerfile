FROM node:22-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

FROM node:22-alpine AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_MATOMO_URL
ARG NEXT_PUBLIC_MATOMO_SITE_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_MATOMO_URL=$NEXT_PUBLIC_MATOMO_URL \
    NEXT_PUBLIC_MATOMO_SITE_ID=$NEXT_PUBLIC_MATOMO_SITE_ID

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

USER nextjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

STOPSIGNAL SIGTERM
CMD ["node", "server.js"]
