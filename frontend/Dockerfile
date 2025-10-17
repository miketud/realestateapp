# ---- Stage 1: Build the app ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./
RUN npm install

# Copy source code and build
COPY . .
RUN npm run build

# ---- Stage 2: Serve the built app ----
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Default Nginx startup command
CMD ["nginx", "-g", "daemon off;"]

