# ─────────────────────────────────────────
#         AKAZA BOT — DOCKERFILE
# ─────────────────────────────────────────

# Use official Node.js LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies needed by Baileys
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    git

# Copy package files first (for caching)
COPY package*.json ./

# Install node modules
RUN npm install --omit=dev

# Copy rest of the project
COPY . .

# Create sessions folder if it doesn't exist
RUN mkdir -p sessions

# Create data folder if it doesn't exist
RUN mkdir -p data

# Expose port (optional, for future web dashboard)
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start Akaza
CMD ["node", "index.js"]
