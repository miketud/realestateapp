# Lightweight Node environment
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy dependency manifests first for caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the backend code
COPY . .

# Expose backend port
EXPOSE 3000

# Default command
CMD ["npm", "run", "start"]
