FROM node:20-bookworm-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    bash \
    curl \
    ghostscript \
    qpdf \
    tesseract-ocr \
    tesseract-ocr-deu \
    tesseract-ocr-eng \
    python3 \
    python3-pip \
    python3-venv \
    procps \
    openssl \
    gosu \
    cron \
    ca-certificates \
    gnupg \
    lsb-release \
    unpaper \
    pngquant \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages for OCR layer embedding
RUN pip3 install --no-cache-dir --break-system-packages \
    ocrmypdf \
    pypdf \
    reportlab \
    PyMuPDF

# Install Docker CLI
RUN install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    chmod a+r /etc/apt/keyrings/docker.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && \
    apt-get install -y docker-ce-cli && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Install git for version detection
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate version file from git
RUN chmod +x ./scripts/get-version.sh && \
    ./scripts/get-version.sh > ./public/version.txt || echo "unknown" > ./public/version.txt

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Bundle TypeScript lib files that aren't included in standalone (with all dependencies)
# Only keep Prisma external since it has native bindings
RUN npx esbuild lib/action-polling.ts lib/google-calendar-tasks.ts \
    --bundle \
    --platform=node \
    --target=node20 \
    --format=cjs \
    --outdir=lib \
    --external:@prisma/client \
    --external:.prisma/client \
    || echo "Bundle completed with warnings"

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create home directory for nextjs user to fix npx
RUN mkdir -p /home/nextjs && chown -R nextjs:nodejs /home/nextjs
ENV HOME=/home/nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy lib files (needed for server-side modules not in standalone)
COPY --from=builder /app/lib ./lib

# Copy Prisma files and CLI
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/prisma ./prisma

# Copy management scripts
COPY --from=builder /app/scripts ./scripts
RUN chmod +x /app/scripts/*.js /app/scripts/*.py /app/scripts/*.sh

# Create storage directories with proper permissions
RUN mkdir -p /app/storage/consume /app/storage/processing /app/storage/error \
    /app/storage/completed /app/storage/database /app/storage/backups /app/storage/logs && \
    chown -R nextjs:nodejs /app/storage && \
    chmod -R 777 /app/storage

# Don't switch to nextjs user yet - entrypoint.sh will do it
# USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Copy and set entrypoint
COPY --chown=nextjs:nodejs entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]
