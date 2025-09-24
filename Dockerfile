# Dockerfile
# Base image with Chromium & Playwright deps preinstalled
FROM mcr.microsoft.com/playwright:v1.55.1-jammy

WORKDIR /app

# Install dependencies first (uses Docker layer cache)
COPY package*.json ./
RUN npm ci

# Copy the rest of your code
COPY . .

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port your Express app listens on
EXPOSE 3000

# Start your server
CMD ["node", "server.mjs"]
