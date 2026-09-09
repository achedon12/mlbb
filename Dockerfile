# syntax=docker/dockerfile:1.7

# ─────────────────────────────────────────────────────────────
# 1. deps — dependances, avec la chaine de compilation native
#    better-sqlite3 est un module natif : il faut un compilateur
#    pour le construire. Ces outils restent confines a cette
#    etape et ne touchent jamais l'image finale.
#    Le cache npm est monte plutot que copie : il ne finit dans
#    aucune couche.
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ─────────────────────────────────────────────────────────────
# 2. builder — compilation Next en mode standalone
#    `output: "standalone"` produit un dossier contenant le
#    serveur et *uniquement* les dependances reellement
#    atteintes par le code. C'est ce qui evite d'embarquer les
#    quelque 400 paquets de node_modules dans l'image.
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# La cle n'est lue qu'au runtime, mais le build prerend des pages : une valeur
# de remplacement suffit a le laisser aboutir sans jamais etre embarquee.
ENV SESSION_SECRET=build-uniquement-non-utilise-au-runtime-000000
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# ─────────────────────────────────────────────────────────────
# 3. runner — Node minimal, sans compilateur ni sources
#    L'image finale ne contient que le serveur compile, les
#    ressources statiques et le module SQLite. Ni le code
#    source, ni npm, ni les outils de build.
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

LABEL org.opencontainers.image.title="mlbb" \
      org.opencontainers.image.description="Base de connaissances Mobile Legends: Bang Bang — heros, builds, tier list et actualites." \
      org.opencontainers.image.source="https://github.com/achedon12/mlbb" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/mlbb.db

# wget sert au HEALTHCHECK ; l'image node-alpine ne l'embarque pas.
RUN apk add --no-cache wget \
 && addgroup -g 1001 -S nodejs \
 && adduser -u 1001 -S nextjs -G nodejs \
 && mkdir -p /data \
 && chown nextjs:nodejs /data

# Les trois copies suivantes sont ordonnees de la moins a la plus volatile,
# pour que le cache de couches serve au maximum entre deux builds.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3001
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3001/api/sante || exit 1

STOPSIGNAL SIGTERM
CMD ["node", "server.js"]
