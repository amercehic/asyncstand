# Development Setup

Complete guide for setting up a development environment for AsyncStand.

## Overview

This guide covers advanced development setup including IDE configuration, debugging, database management, and development workflows.

## Prerequisites

### System Requirements

- **Operating System**: macOS, Linux, or Windows (WSL2 recommended)
- **Node.js**: Version 20.0.0 or higher
- **pnpm**: Version 10.0.0 or higher
- **PostgreSQL**: Version 14.0 or higher
- **Redis**: Version 6.0 or higher
- **Git**: Version 2.30 or higher

### Development Tools

- **Code Editor**: VS Code (recommended), WebStorm, or Vim
- **Terminal**: Terminal app, iTerm2, or Windows Terminal
- **API Testing**: Postman, Insomnia, or curl
- **Database Client**: pgAdmin, TablePlus, or Prisma Studio

## Detailed Installation

### Node.js and pnpm

#### Using Node Version Manager (Recommended)

```bash
# Install nvm (macOS/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# Install pnpm globally
npm install -g pnpm@latest

# Verify installations
node --version  # Should show v20.x.x
pnpm --version  # Should show 10.x.x
```

#### Direct Installation

```bash
# Download from nodejs.org
# Follow installation instructions for your OS

# Install pnpm
npm install -g pnpm
```

### PostgreSQL Setup

#### macOS (Homebrew)

```bash
# Install PostgreSQL
brew install postgresql@14

# Start PostgreSQL service
brew services start postgresql@14

# Create superuser (optional)
createuser -s postgres

# Connect to PostgreSQL
psql -U postgres
```

#### Ubuntu/Debian

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql-14 postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Switch to postgres user and set password
sudo -u postgres psql
\password postgres
\q
```

#### Windows

```bash
# Download installer from postgresql.org
# Run installer and follow setup wizard
# Remember the superuser password

# Add PostgreSQL to PATH
# C:\Program Files\PostgreSQL\14\bin
```

### Redis Setup

#### macOS (Homebrew)

```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Test Redis connection
redis-cli ping  # Should return PONG
```

#### Ubuntu/Debian

```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test Redis connection
redis-cli ping
```

#### Windows

```bash
# Option 1: Use WSL2 and follow Linux instructions

# Option 2: Download Redis for Windows
# https://github.com/microsoftarchive/redis/releases

# Option 3: Use Docker
docker run -d -p 6379:6379 redis:6-alpine
```

## Project Setup

### Repository Setup

```bash
# Clone the repository
git clone https://github.com/your-org/asyncstand.git
cd asyncstand

# Add upstream remote (for contributors)
git remote add upstream https://github.com/original-owner/asyncstand.git

# Install all dependencies
pnpm install

# Verify installation
pnpm --version
```

### Database Configuration

#### Create Development Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE asyncstand_dev;
CREATE USER asyncstand_dev WITH PASSWORD 'dev_password';
GRANT ALL PRIVILEGES ON DATABASE asyncstand_dev TO asyncstand_dev;

# Create test database
CREATE DATABASE asyncstand_test;
GRANT ALL PRIVILEGES ON DATABASE asyncstand_test TO asyncstand_dev;

# Exit PostgreSQL
\q
```

#### Configure Environment

```bash
# Copy environment template
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env

# Edit backend environment
nano apps/backend/.env
```

Update the following in `apps/backend/.env`:

```bash
# Database
DATABASE_URL=postgresql://asyncstand_dev:dev_password@localhost:5432/asyncstand_dev

# JWT Secret (generate a secure one)
JWT_SECRET=your-super-secure-development-jwt-secret-key

# Redis
REDIS_URL=redis://localhost:6379

# Frontend URL
FRONTEND_URL=http://localhost:3000

# SMTP (use Mailtrap for development)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-username
SMTP_PASS=your-mailtrap-password
FROM_EMAIL=dev@asyncstand.local
```

#### Run Database Migrations

```bash
cd apps/backend

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed database (optional)
pnpm db:seed

# Open Prisma Studio to verify
pnpm db:studio
```

## IDE Configuration

### VS Code Setup

#### Recommended Extensions

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "Prisma.prisma",
    "ms-vscode-remote.remote-containers",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml"
  ]
}
```

#### Workspace Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "eslint.workingDirectories": ["apps/backend", "apps/frontend"],
  "prisma.showPrismaDataPlatformNotification": false,
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.turbo": true
  }
}
```

#### Launch Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/apps/backend/src/main.ts",
      "cwd": "${workspaceFolder}/apps/backend",
      "runtimeArgs": ["-r", "ts-node/register"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true,
      "runtimeExecutable": "node"
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "cwd": "${workspaceFolder}/apps/backend",
      "args": ["--runInBand", "--detectOpenHandles"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

#### Tasks Configuration

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Development",
      "type": "shell",
      "command": "pnpm dev",
      "group": "build",
      "isBackground": true,
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "new"
      }
    },
    {
      "label": "Run Tests",
      "type": "shell",
      "command": "pnpm test",
      "group": "test"
    },
    {
      "label": "Build Project",
      "type": "shell",
      "command": "pnpm build",
      "group": "build"
    }
  ]
}
```

### WebStorm/IntelliJ Setup

#### Enable Node.js Integration

1. **File → Settings → Languages & Frameworks → Node.js**
2. Set Node interpreter to your Node.js installation
3. Enable Node.js Core library

#### Configure TypeScript

1. **File → Settings → Languages & Frameworks → TypeScript**
2. Set TypeScript service to use project version
3. Enable TypeScript Language Service

#### Setup Run Configurations

1. **Run → Edit Configurations**
2. Add new **Node.js** configuration:
   - **Name**: Backend Development
   - **Node interpreter**: Project Node.js
   - **Working directory**: `apps/backend`
   - **JavaScript file**: `src/main.ts`
   - **Environment variables**: `NODE_ENV=development`

## Development Workflow

### Starting Development

#### Option 1: All Services at Once

```bash
# Start all services (backend, frontend, worker)
pnpm dev

# Services will be available at:
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
# API Docs: http://localhost:3001/api
```

#### Option 2: Individual Services

```bash
# Terminal 1: Backend
cd apps/backend
pnpm dev

# Terminal 2: Frontend
cd apps/frontend
pnpm dev

# Terminal 3: Worker (optional)
cd apps/worker
pnpm dev
```

### Development Tools

#### Database Management

```bash
# Open Prisma Studio
cd apps/backend
pnpm db:studio

# Reset database (caution: deletes all data)
pnpm db:reset

# Push schema changes without migration
pnpm db:push

# Create new migration
pnpm db:migrate --name add-new-feature
```

#### Redis Management

```bash
# Connect to Redis CLI
redis-cli

# Monitor Redis commands
redis-cli monitor

# Clear all Redis data
redis-cli flushall
```

### Testing Workflow

#### Running Tests

```bash
# Run all tests
pnpm test

# Run tests by type
pnpm test:unit
pnpm test:integration
pnpm test:e2e

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test auth.service.test.ts

# Run tests with debug output
pnpm test --verbose
```

#### Test Database

Tests use a separate database that's automatically managed:

```bash
# Test database URL (configured in jest setup)
DATABASE_URL=postgresql://asyncstand_dev:dev_password@localhost:5432/asyncstand_test
```

### Code Quality

#### Linting and Formatting

```bash
# Check linting
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Check formatting
pnpm format:check

# Type checking
pnpm typecheck
```

#### Pre-commit Hooks

Install pre-commit hooks with Husky:

```bash
# Install Husky
pnpm add -D husky

# Initialize Husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "pnpm lint && pnpm test:unit"
```

## Debugging

### Backend Debugging

#### VS Code Debugging

1. Set breakpoints in your code
2. Press `F5` or use **Run → Start Debugging**
3. Select "Debug Backend" configuration

#### Console Debugging

```bash
# Start with debugger
cd apps/backend
pnpm dev:debug

# Attach Chrome DevTools
# Open chrome://inspect in Chrome
# Click "Open dedicated DevTools for Node"
```

#### Using Debug Logs

```typescript
import { Logger } from '@nestjs/common';

export class MyService {
  private readonly logger = new Logger(MyService.name);

  async myMethod() {
    this.logger.debug('Starting method execution');
    this.logger.log('Important information');
    this.logger.warn('Warning message');
    this.logger.error('Error occurred');
  }
}
```

### Frontend Debugging

#### Browser DevTools

1. Open browser developer tools (F12)
2. Use **Sources** tab for breakpoints
3. Use **Console** for logging
4. Use **Network** tab for API calls

#### React Developer Tools

Install React DevTools browser extension:

- [Chrome Extension](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
- [Firefox Extension](https://addons.mozilla.org/en-US/firefox/addon/react-devtools/)

### Database Debugging

#### Query Logging

Enable Prisma query logging in development:

```typescript
// prisma/prisma.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

#### Using Prisma Studio

```bash
cd apps/backend
pnpm db:studio
```

This opens a web interface at http://localhost:5555 for browsing and editing data.

## Environment Management

### Multiple Environments

Create environment-specific files:

```bash
apps/backend/.env.development
apps/backend/.env.test
apps/backend/.env.staging
apps/backend/.env.production
```

### Environment Switching

```bash
# Set environment
export NODE_ENV=development

# Or use cross-env for Windows compatibility
npx cross-env NODE_ENV=development pnpm dev
```

### Secret Management

For development, use a `.env.local` file for secrets:

```bash
# .env.local (add to .gitignore)
JWT_SECRET=your-secret-key
SLACK_CLIENT_SECRET=your-slack-secret
```

## Performance Optimization

### Development Performance

#### Enable TypeScript Incremental Compilation

```json
// tsconfig.json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "./node_modules/.cache/tsbuildinfo"
  }
}
```

#### Optimize pnpm

```bash
# Use store path for faster installs
pnpm config set store-dir ~/.pnpm-store

# Enable shamefully-hoist for better compatibility
pnpm config set shamefully-hoist true
```

### Build Performance

#### Turbo Configuration

Optimize `turbo.json` for development:

```json
{
  "pipeline": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

## Troubleshooting

### Common Development Issues

#### Port Already in Use

```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>

# Or use different port
PORT=3002 pnpm dev
```

#### Database Connection Issues

```bash
# Check PostgreSQL status
brew services list | grep postgresql
# or
sudo systemctl status postgresql

# Test connection
psql -U asyncstand_dev -d asyncstand_dev -h localhost
```

#### pnpm Issues

```bash
# Clear pnpm cache
pnpm store prune

# Remove node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### TypeScript Issues

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache
pnpm build

# Check TypeScript version
npx tsc --version
```

### Getting Help

- **Documentation**: Check project docs and README files
- **Issues**: Search GitHub issues for similar problems
- **Community**: Use GitHub Discussions for questions
- **Debug**: Enable debug logging and check application logs

---

This development setup should provide a robust environment for AsyncStand development. For additional configuration options, see the [Environment Configuration](./environment.md) guide.
