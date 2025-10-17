# ==========================================
# Stage 1 — Builder
# ==========================================
FROM node:20-slim AS builder
WORKDIR /app

# Prisma needs OpenSSL on debian-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Install all deps (incl. dev) deterministically
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Copy prisma first for better layer caching and generate the client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source and build (TS -> JS). If JS-only, this no-ops.
COPY . .
RUN npm run build || echo "No build step; assuming JS sources"

# Ensure dist/server.js exists even for JS-only apps
RUN mkdir -p dist && if [ -f server.js ] && [ ! -f dist/server.js ]; then cp server.js dist/server.js; fi

# ==========================================
# Stage 2 — Production Runtime
# ==========================================
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Runtime libs for Prisma
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Install only prod deps
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy Prisma schema and the already generated client from builder
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy the built app
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Run migrations then start Fastify
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
