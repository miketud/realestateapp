# ==========================================
# Stage 1 — Build the Vite frontend
# ==========================================
FROM node:20-bullseye AS builder
WORKDIR /app

# --------------------------------------------------
# 1️⃣ Install dependencies efficiently
# --------------------------------------------------
COPY package*.json ./
RUN npm cache clean --force \
  && rm -rf node_modules package-lock.json \
  && npm install --no-audit --no-fund \
  && npm rebuild esbuild rollup --verbose

# --------------------------------------------------
# 2️⃣ Copy project source and build
# --------------------------------------------------
COPY . .

# ✅ Use the same variable name your app expects
ARG VITE_API_BASE=http://realestateapp-backend:3000
ENV VITE_API_BASE=$VITE_API_BASE

# Check esbuild binary and build Vite app
RUN npx esbuild --version && npm run build


# ==========================================
# Stage 2 — Serve with Nginx
# ==========================================
FROM nginx:1.25-alpine

# --------------------------------------------------
# 3️⃣ Copy built static files
# --------------------------------------------------
COPY --from=builder /app/dist /usr/share/nginx/html

# --------------------------------------------------
# 4️⃣ Configure Nginx for SPA routing and backend proxy
# --------------------------------------------------
RUN <<'EOF'
cat > /etc/nginx/conf.d/default.conf <<'CONF'
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # ✅ Serve static frontend & handle React Router / SPA routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # ✅ Prevent recursion on /index.html requests
    location = /index.html {
        add_header Cache-Control "no-store";
    }

    # ✅ Proxy API requests to Fastify backend (Docker internal name)
    location /api/ {
        proxy_pass http://realestateapp-backend:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
    }

    # ✅ Basic security headers
    add_header X-Content-Type-Options "nosniff";
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
}
CONF
EOF

# --------------------------------------------------
# 5️⃣ Expose and run Nginx
# --------------------------------------------------
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
