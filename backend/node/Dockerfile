# ---- Stage 1: Build the backend ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy only dependency files first (better build cache)
COPY package*.json ./

RUN npm install

# Copy all source code (including Prisma schema and migrations)
COPY . .

# Generate Prisma client for the container OS
RUN npx prisma generate

# Compile TypeScript to JavaScript
RUN npm run build

# ---- Stage 2: Run the backend ----
FROM node:20-alpine

WORKDIR /app

# Copy built app and node_modules from builder stage
COPY --from=builder /app /app

# Expose Fastify port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production

# Automatically apply Prisma migrations before server starts
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
