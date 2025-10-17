# ===============================
# Stage 1 — Build the Vite app
# ===============================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy and install dependencies
COPY package*.json ./
RUN npm install

# Copy all frontend source files
COPY . .

# Pass build-time environment variable for backend API
ARG VITE_API_URL=http://realestateapp-backend:3000
ENV VITE_API_URL=$VITE_API_URL

# Build the production bundle
RUN npm run build

# ===============================
# Stage 2 — Serve with Nginx
# ===============================
FROM nginx:alpine

# Copy build output from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing fix: redirect all non-file requests to index.html
RUN printf 'server {\n\
    listen 80;\n\
    server_name localhost;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    location / {\n\
        try_files $uri /index.html;\n\
    }\n\
\n\
    location /api/ {\n\
        proxy_pass http://realestateapp-backend:3000/;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n\
    }\n\
}' > /etc/nginx/conf.d/default.conf

# Expose the web server port
EXPOSE 80

# Run Nginx in foreground mode
CMD ["nginx", "-g", "daemon off;"]
