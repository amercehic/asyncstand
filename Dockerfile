# Use Node.js 20 as base image
FROM node:20-slim AS base

# Install dependencies for better container security
RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

# Copy Prisma schema for postinstall script
COPY apps/backend/prisma ./apps/backend/prisma

# Install dependencies
FROM base AS deps
# Railway doesn't support cache mounts, so we install directly
RUN pnpm install --frozen-lockfile

# Build the application
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules
COPY . .

# Build both backend and frontend
RUN pnpm build

# Production stage
FROM node:20-slim AS production

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack for pnpm in production
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

WORKDIR /app

# Copy built application
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps ./apps

# Set environment
ENV NODE_ENV=production

# Expose port (Railway will override with PORT env var)
EXPOSE 3000

# Start the application
CMD ["pnpm", "start:prod"]