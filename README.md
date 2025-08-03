# AsyncStand

<div align="center">

**An async standup platform for distributed teams** (In Development)

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11+-red.svg)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-19+-blue.svg)](https://reactjs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10+-yellow.svg)](https://pnpm.io/)

</div>

---

## 🚀 Overview

AsyncStand is a multi-tenant SaaS platform designed to enable asynchronous standup meetings integrated with Slack. The project is currently in active development with core backend functionality implemented and frontend/worker components planned.

### ✅ Implemented Features

- **🔐 Complete Authentication System** - User signup, login, JWT tokens, password reset
- **👥 Organization Management** - Multi-tenant architecture with role-based access control
- **👤 Member Management** - Invite users, manage roles (Owner, Admin, Member), suspension
- **🏢 Team Management** - Create/manage teams linked to Slack channels  
- **🔗 Slack OAuth Integration** - Complete OAuth flow for Slack workspace integration
- **📊 Comprehensive Audit Logging** - Track all system activities with detailed metadata
- **🗄️ Robust Database Schema** - Multi-tenant PostgreSQL schema with Prisma ORM
- **🧪 Testing Infrastructure** - Unit, integration, and E2E test suites

### 🚧 Planned Features

- **📱 Frontend Web Application** - React-based dashboard (currently basic starter)
- **⚙️ Background Job Processing** - Email notifications, scheduled tasks (worker planned)
- **📈 Standup Analytics** - Team performance insights and reporting
- **🔔 Advanced Notifications** - Multiple notification channels beyond Slack

## 🏗️ Architecture

This is a TypeScript monorepo with the following structure:

```
asyncstand/
├── apps/
│   ├── backend/          # NestJS API server (✅ Implemented)
│   ├── frontend/         # React web app (🚧 Basic starter)
│   └── worker/           # Background jobs (🚧 Planned)
├── packages/
│   └── shared/           # Common types and utilities (✅ Implemented)
└── docs/                 # Project documentation
```

### Tech Stack

#### Backend (Implemented)
- **Framework**: NestJS 11+ with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh tokens, Passport.js
- **Security**: Argon2 password hashing, role-based access control
- **Integrations**: Slack OAuth 2.0, Slack Web API
- **Caching/Sessions**: Redis for caching and session management
- **Logging**: Structured logging with Pino
- **Validation**: class-validator for DTO validation
- **API Documentation**: Swagger/OpenAPI
- **Testing**: Jest (unit, integration, E2E)

#### Frontend (Basic Starter)
- **Framework**: React 19 with Vite
- **Language**: TypeScript
- **Status**: Basic Vite starter template

#### Development Tools
- **Package Manager**: pnpm with workspace support
- **Build Tool**: Turbo for monorepo orchestration
- **Code Quality**: ESLint, Prettier, TypeScript strict mode

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+**
- **pnpm 10+** 
- **PostgreSQL 14+**
- **Redis 6+**

### Installation

```bash
# Clone and install dependencies
git clone <repository-url>
cd asyncstand
pnpm install

# Set up environment files
pnpm env:setup

# Configure your databases in apps/backend/.env:
# DATABASE_URL=postgresql://user:password@localhost:5432/asyncstand
# REDIS_URL=redis://localhost:6379

# Run database migrations
cd apps/backend
pnpm db:migrate

# Start development servers
cd ../..
pnpm dev
```

This will start:
- Backend API: http://localhost:3001
- Frontend: http://localhost:3000 (basic starter)

## 📋 Available Commands

### Root Level
```bash
pnpm dev              # Start all apps in development mode
pnpm build            # Build all applications
pnpm test             # Run all tests
pnpm lint             # Lint all packages
pnpm format           # Format code with Prettier
```

### Backend (`apps/backend/`)
```bash
pnpm dev              # Start development server with hot reload
pnpm build            # Build for production
pnpm start:prod       # Start production server

# Testing
pnpm test             # Run all tests
pnpm test:unit        # Run unit tests only
pnpm test:integration # Run integration tests only  
pnpm test:e2e         # Run end-to-end tests only
pnpm test:coverage    # Run tests with coverage

# Database
pnpm db:migrate       # Run database migrations
pnpm db:studio        # Open Prisma Studio
pnpm db:generate      # Generate Prisma client
pnpm db:reset         # Reset database (dev only)
```

### Frontend (`apps/frontend/`)
```bash
pnpm dev              # Start Vite dev server
pnpm build            # Build for production
pnpm preview          # Preview production build
```

## 📁 Project Structure

### Backend Application
```
apps/backend/src/
├── auth/                 # Authentication & authorization
│   ├── controllers/      # Auth, org-members, organization
│   ├── services/         # Business logic
│   ├── guards/           # JWT & role-based guards
│   └── dto/              # Request/response validation
├── teams/                # Team management
├── integrations/         # External integrations (Slack)
├── common/               # Shared utilities
│   └── audit/            # Audit logging system
├── config/               # Environment & app configuration
└── prisma/               # Database schema & client
```

## 🔧 Configuration

Key environment variables (see `docs/getting-started/environment.md` for complete list):

```bash
# Core
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379

# Authentication  
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:3000

# Email (SMTP)
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password

# Slack Integration
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_OAUTH_ENABLED=true
```

## 🧪 Testing

The project includes comprehensive testing:

- **Unit Tests**: Individual component testing
- **Integration Tests**: Service and database integration
- **E2E Tests**: Full API workflow testing

```bash
# Run specific test suites
pnpm test:unit           # Fast unit tests
pnpm test:integration    # Database integration tests  
pnpm test:e2e           # End-to-end API tests
```

## 🚀 Production Deployment

### Prerequisites
- Node.js 20+ runtime
- PostgreSQL 14+ database
- Redis 6+ instance
- SMTP service for emails
- SSL certificates

### Build & Deploy
```bash
# Build all applications
pnpm build

# Start backend in production
cd apps/backend
NODE_ENV=production pnpm start:prod
```

## 📚 Documentation

Complete documentation is available in the `docs/` folder:

- **[Getting Started](docs/getting-started/quick-start.md)** - Setup and first steps
- **[Backend Development](docs/development/backend.md)** - Detailed backend guide
- **[API Reference](docs/api-reference.md)** - Complete API documentation
- **[Database Schema](docs/architecture/database-schema.md)** - Database design
- **[Contributing](docs/contributing/guidelines.md)** - How to contribute

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](docs/contributing/guidelines.md) for details on:

- Development setup
- Code standards
- Pull request process
- Testing requirements

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

---

## 🗺️ Development Roadmap

### Current Phase: Core Backend (✅ Mostly Complete)
- [x] Authentication system
- [x] Organization & member management  
- [x] Team management
- [x] Slack integration
- [x] Audit logging
- [x] API documentation

### Next Phase: Frontend Development (🚧 In Progress)
- [ ] Authentication UI
- [ ] Organization dashboard
- [ ] Team management interface
- [ ] Standup configuration
- [ ] Slack integration UI

### Future Phases
- [ ] Background job processing (worker)
- [ ] Advanced standup analytics
- [ ] Mobile application
- [ ] Additional integrations (Teams, Discord)

**Status**: Active development - backend core complete, frontend and worker in planning phase. 