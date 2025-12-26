# ---------- Stage 1: Build ----------
FROM node:20-bullseye AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---------- Stage 2: Nginx ----------
FROM nginx:1.25-alpine
RUN rm -f /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA + API proxy (LF-safe heredocs)
RUN set -eux; cat >/etc/nginx/conf.d/default.conf <<'CONF'
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # cache immutable assets
    location ~* \.(?:js|mjs|css|woff2?|ttf|otf|eot|svg|png|jpg|jpeg|gif|webp)$ {
        access_log off;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # SPA routing
    location / { try_files $uri $uri/ /index.html; }

    # don't cache the HTML shell
    location = /index.html { add_header Cache-Control "no-store"; }

    # API proxy (no trailing slash so /api/* is preserved)
    location /api/ {
        proxy_pass http://realestateapp-backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
    }

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
CONF

RUN set -eux; cat >/etc/nginx/conf.d/gzip.conf <<'CONF'
gzip on;
gzip_types text/plain text/css application/javascript application/json application/xml image/svg+xml;
gzip_min_length 1024;
CONF

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
