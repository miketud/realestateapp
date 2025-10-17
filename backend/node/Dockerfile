FROM node:20-alpine

WORKDIR /app

# Copy only package files first for caching
COPY package*.json ./

RUN npm install

# Copy the rest of the app (now excluding node_modules via .dockerignore)
COPY . .

# Generate Prisma client inside Docker
RUN npx prisma generate

# Build TypeScript → JavaScript
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/server.js"]
