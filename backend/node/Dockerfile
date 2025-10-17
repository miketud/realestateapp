# ===========================================
# Stage 1 — Builder
# ===========================================
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL (required by Prisma)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy dependency files first for layer caching
COPY package*.json ./

# Install dependencies (cleanly and reproducibly)
RUN npm ci

# Copy the full source (including Prisma schema, migrations, etc.)
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript -> JavaScript
RUN npm run build


# ===========================================
# Stage 2 — Production Runtime
# ===========================================
FROM node:20-slim AS runtime

WORKDIR /app

# Install OpenSSL (for Prisma) and curl (for Docker healthcheck)
RUN apt-get update -y \
  && apt-get install -y openssl curl \
  && rm -rf /var/lib/apt/lists/*

# Copy only necessary files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production
ENV PORT=3000

# Expose backend port
EXPOSE 3000

# Run database migrations, then start Fastify
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
