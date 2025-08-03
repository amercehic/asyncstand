# Quick Start Guide

Get AsyncStand running locally to explore the implemented backend API and basic frontend.

## Prerequisites

Before starting, ensure you have the following installed:

### Required Software

- **Node.js 20+** - [Download from nodejs.org](https://nodejs.org/)
- **pnpm 10+** - Install with `npm install -g pnpm`
- **PostgreSQL 14+** - [Download from postgresql.org](https://www.postgresql.org/download/)
- **Redis 6+** - [Download from redis.io](https://redis.io/download/)

## Step 1: Clone and Install

```bash
# Clone the repository  
git clone <your-repository-url>
cd asyncstand

# Install all dependencies (this may take a few minutes)
pnpm install
```

## Step 2: Database Setup

### Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE asyncstand;
CREATE USER asyncstand_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE asyncstand TO asyncstand_user;
\q
```

### Start Redis

```bash
# macOS (with Homebrew)
brew services start redis

# Linux (systemd)
sudo systemctl start redis

# Windows (if using WSL)
sudo service redis-server start

# Verify Redis is running
redis-cli ping  # Should return: PONG
```

## Step 3: Environment Configuration

### Configure Backend Environment

Create `apps/backend/.env` with your database settings:

```bash
# Core Configuration
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://asyncstand_user:your_password@localhost:5432/asyncstand

# Authentication
JWT_SECRET=your-development-jwt-secret-key-here
FRONTEND_URL=http://localhost:3000

# Redis
REDIS_URL=redis://localhost:6379

# Email (Optional for development - can be left empty)
FROM_EMAIL=dev@asyncstand.local
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Slack Integration (Optional - can be left empty)
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_OAUTH_ENABLED=false

# Logging
LOG_LEVEL=debug
LOG_PRETTY=true

# Security
DATABASE_ENCRYPT_KEY=development-encryption-key-32chars
```

### Configure Frontend Environment (Optional)

Create `apps/frontend/.env` if you want to change the API URL:

```bash
VITE_API_URL=http://localhost:3001
```

## Step 4: Database Migration

```bash
cd apps/backend

# Run database migrations
pnpm db:migrate

# Generate Prisma client
pnpm db:generate

# Optional: Open Prisma Studio to explore the database
pnpm db:studio
```

## Step 5: Start Development Servers

### Option 1: Start All Services

```bash
# From the root directory
pnpm dev
```

This will start:
- **Backend API**: http://localhost:3001
- **Frontend**: http://localhost:3000 (basic React starter)

### Option 2: Start Individual Services

```bash
# Backend only (most useful for API development)
cd apps/backend
pnpm dev

# Frontend only (if needed)
cd apps/frontend  
pnpm dev
```

## Step 6: Verify Installation

### Test Backend API

1. **Health Check**: http://localhost:3001
2. **API Documentation**: http://localhost:3001/api/docs (Swagger UI)

### Test Authentication Flow

Use the Swagger UI or test with curl:

```bash
# Sign up a new user
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'

# Login with the user
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Explore Available APIs

The following endpoints are currently implemented:

- **Authentication**: `/auth/*` - Signup, login, logout, password reset
- **Organizations**: `/org` - Get/update organization details
- **Members**: `/org/members/*` - Invite, list, manage organization members
- **Teams**: `/teams/*` - Create and manage teams linked to Slack channels
- **Slack Integration**: `/slack/oauth/*` - Slack OAuth flow

## What's Working vs. Planned

### ✅ Currently Implemented

- **Complete Authentication System** - User signup, login, JWT tokens, password reset
- **Organization Management** - Multi-tenant organizations with role-based access
- **Member Management** - Invite users, manage roles (Owner, Admin, Member), user suspension
- **Team Management** - Create/manage teams linked to Slack channels
- **Slack OAuth Integration** - Complete OAuth flow for workspace integration
- **API Documentation** - Swagger UI available at `/api/docs`
- **Database Schema** - Complete multi-tenant schema with audit logging
- **Testing Infrastructure** - Unit, integration, and E2E tests

### 🚧 In Development / Planned

- **Frontend Application** - Currently just a basic React starter template
- **Background Job Processing** - Worker application is empty, email/notifications planned
- **Standup Features** - Database schema exists, API endpoints planned
- **Advanced Slack Features** - Slash commands, bot interactions
- **Email Notifications** - SMTP configuration ready, templates planned

## Development Workflow

### Common Commands

```bash
# Backend development
cd apps/backend
pnpm dev              # Start with hot reload
pnpm test             # Run all tests
pnpm test:unit        # Run unit tests only
pnpm db:studio        # Open database GUI
pnpm lint             # Check code quality

# Database management
pnpm db:migrate       # Run new migrations
pnpm db:reset         # Reset database (dev only)
pnpm db:generate      # Regenerate Prisma client

# Frontend development
cd apps/frontend
pnpm dev              # Start Vite dev server
pnpm build            # Build for production
```

### Using the API

1. **Explore with Swagger**: Visit http://localhost:3001/api/docs for interactive API documentation
2. **Authentication Required**: Most endpoints require JWT tokens from login
3. **Organization Context**: APIs are scoped to user's organization automatically
4. **Role-Based Access**: Different endpoints require different roles (Owner, Admin, Member)

## Common Issues and Solutions

### Database Connection Issues

```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Verify database exists
psql -U asyncstand_user -d asyncstand -h localhost
```

### Redis Connection Issues

```bash
# Check if Redis is running
redis-cli ping

# Check Redis connection
redis-cli -u redis://localhost:6379 ping
```

### Port Conflicts

If ports 3000 or 3001 are in use:

```bash
# Backend: Change PORT in apps/backend/.env
PORT=3002

# Frontend: Start with custom port
cd apps/frontend
pnpm dev --port 3001
```

### JWT Secret Issues

Ensure your JWT_SECRET is set in `apps/backend/.env`:

```bash
# Generate a secure secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Environment Variable Issues

```bash
# Verify environment loading
cd apps/backend
node -e "console.log(process.env.DATABASE_URL)"
```

## Next Steps

### For Backend Development

1. **Explore the API**: Use Swagger UI to test endpoints
2. **Read the Database Schema**: Check `apps/backend/prisma/schema.prisma`
3. **Review Tests**: Look at `apps/backend/test/` for examples
4. **Check Documentation**: Read [Backend Development Guide](../development/backend.md)

### For Frontend Development

1. **Understand Current State**: Frontend is a basic Vite + React starter
2. **API Integration**: Use `apps/frontend/src/lib/api.ts` for API calls
3. **Authentication**: Implement login/signup UI components
4. **Organization Management**: Build organization and team management interfaces

### For Integration Development

1. **Slack Setup**: Configure Slack app for OAuth testing
2. **Test OAuth Flow**: Use `/slack/oauth/start?orgId=<org-id>` to test
3. **Webhook Testing**: Test with tools like ngrok for local development

## Getting Help

- **Documentation**: Check the `docs/` folder for detailed guides
- **API Reference**: Use Swagger UI at http://localhost:3001/api/docs
- **Database Exploration**: Use Prisma Studio with `pnpm db:studio`
- **Logs**: Check terminal output for detailed error messages
- **Testing**: Run tests to verify functionality

## Security Notes

- **Development Only**: This setup is for development - don't use in production
- **Default Secrets**: Change all default passwords and secrets
- **Database Access**: The setup creates a database user with full privileges
- **HTTPS**: Production requires SSL/TLS certificates and proper security configuration

---

🎉 **You're Ready!** You now have AsyncStand running locally with a complete backend API and can start exploring the authentication, organization management, and team features that are currently implemented.
