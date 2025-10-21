# Dockerfile
FROM mcr.microsoft.com/playwright:v1.55.1-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Install puppeteer-core only (lighter than puppeteer full)
RUN npm install puppeteer-core

COPY . .

ENV NODE_ENV=production
ENV PORT=3000

# Chromium path baked into the Playwright image

EXPOSE 3000
CMD ["node", "server.mjs"]
