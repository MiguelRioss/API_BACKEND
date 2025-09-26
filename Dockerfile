# Usa imagem oficial Node como base (leve)
FROM node:20-slim

# Instala dependências do Chromium necessárias para o Puppeteer funcionar
RUN apt-get update && apt-get install -y \
  chromium \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  xdg-utils \
  wget \
  && rm -rf /var/lib/apt/lists/*

# Define diretório de trabalho
WORKDIR /app

# Copia dependências
COPY package*.json ./

# Instala apenas puppeteer-core (não inclui Chromium)
RUN npm ci --omit=dev && npm install puppeteer-core@21

# Copia o resto do código
COPY . .

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3000
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Expõe porta
EXPOSE 3000

# Arranque
CMD ["node", "server.mjs"]
