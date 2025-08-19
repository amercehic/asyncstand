<div align="center">

# 🏃‍♂️ AsyncStand

<h3>⚡ The modern async standup platform for distributed teams</h3>

<p>
<strong>🚀 Built for modern teams</strong> • <strong>🔗 Slack Integration</strong> • <strong>📊 Analytics Ready</strong> • <strong>🌍 Multi-tenant SaaS</strong>
</p>

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11+-E0234E.svg?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-19+-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791.svg?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-6+-DC382D.svg?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![pnpm](https://img.shields.io/badge/pnpm-10+-F69220.svg?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)

<p><em>Currently in active development 🚧</em></p>

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

### 📋 Prerequisites

Make sure you have the following installed:

<table>
<tr>
<td><strong>🟢 Node.js</strong></td>
<td>Version 20 or higher</td>
</tr>
<tr>
<td><strong>📦 pnpm</strong></td>
<td>Version 10 or higher</td>
</tr>
<tr>
<td><strong>🐘 PostgreSQL</strong></td>
<td>Version 14 or higher</td>
</tr>
<tr>
<td><strong>🔴 Redis</strong></td>
<td>Version 6 or higher</td>
</tr>
</table>

### ⚡ Installation

Follow these steps to get AsyncStand running locally:

#### **Step 1: Clone & Install**
```bash
# Clone the repository
git clone https://github.com/yourusername/asyncstand.git
cd asyncstand

# Install all dependencies
pnpm install
```

#### **Step 2: Environment Setup**
```bash
# Set up environment files automatically
pnpm env:setup

# This creates .env files in all apps with sensible defaults
```

#### **Step 3: Database Configuration**
Edit your database configuration in `apps/backend/.env`:

```bash
# Required database connections
DATABASE_URL=postgresql://user:password@localhost:5432/asyncstand
REDIS_URL=redis://localhost:6379

# Optional: JWT secret for development
JWT_SECRET=your-super-secret-development-key
```

#### **Step 4: Database Migration**
```bash
# Navigate to backend and run migrations
cd apps/backend
pnpm db:migrate

# Return to root directory
cd ../..
```

#### **Step 5: Start Development**
```bash
# Start all development servers in parallel
pnpm dev
```

### 🌐 Access Your Application

Once running, you can access:

| Service | URL | Description |
|---------|-----|-------------|
| 🖥️ **Frontend** | [http://localhost:3000](http://localhost:3000) | React web application |
| 🔗 **Backend API** | [http://localhost:3001](http://localhost:3001) | NestJS REST API |
| 📚 **API Docs** | [http://localhost:3001/api](http://localhost:3001/api) | Interactive Swagger documentation |

> 🎉 **Success!** Your AsyncStand development environment is now running!

## 📋 Available Commands

### 🏠 Root Level Commands

| Command | Description | Icon |
|---------|-------------|------|
| `pnpm dev` | Start all apps in development mode | 🚀 |
| `pnpm build` | Build all applications for production | 🏗️ |
| `pnpm test` | Run all test suites across the monorepo | 🧪 |
| `pnpm lint` | Lint all packages and fix issues | ✨ |
| `pnpm format` | Format code with Prettier | 💄 |
| `pnpm env:setup` | Set up environment files for all apps | ⚙️ |

### 🔗 Backend Commands (`apps/backend/`)

<details>
<summary><strong>🖥️ Development & Production</strong></summary>

```bash
pnpm dev              # 🚀 Start development server with hot reload
pnpm build            # 🏗️ Build for production
pnpm start:prod       # ▶️ Start production server
```
</details>

<details>
<summary><strong>🧪 Testing Commands</strong></summary>

```bash
pnpm test             # 🧪 Run all tests
pnpm test:unit        # ⚡ Run unit tests only
pnpm test:integration # 🔗 Run integration tests only
pnpm test:e2e         # 🌐 Run end-to-end tests only
pnpm test:coverage    # 📊 Run tests with coverage report
```
</details>

<details>
<summary><strong>🗄️ Database Operations</strong></summary>

```bash
pnpm db:migrate       # 🔄 Run database migrations
pnpm db:studio        # 👀 Open Prisma Studio (database GUI)
pnpm db:generate      # 🔧 Generate Prisma client
pnpm db:reset         # 🗑️ Reset database (development only)
pnpm db:seed          # 🌱 Seed database with test data
```
</details>

### 🎨 Frontend Commands (`apps/frontend/`)

| Command | Description | Icon |
|---------|-------------|------|
| `pnpm dev` | Start Vite development server | ⚡ |
| `pnpm build` | Build for production | 📦 |
| `pnpm preview` | Preview production build | 👁️ |
| `pnpm test` | Run frontend tests | 🧪 |

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

We welcome contributions from developers of all skill levels! 

### 🚀 Quick Contribution Guide

1. **🍴 Fork** the repository
2. **🌿 Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **✍️ Make** your changes and add tests
4. **✅ Test** your changes: `pnpm test`
5. **💫 Format** your code: `pnpm format`
6. **📝 Commit** your changes: `git commit -m 'Add amazing feature'`
7. **🚀 Push** to your branch: `git push origin feature/amazing-feature`
8. **📬 Open** a Pull Request

### 📚 Documentation

For detailed contribution guidelines, please see:
- **[Contributing Guidelines](docs/contributing/guidelines.md)** - Code standards and process
- **[Backend Development](docs/development/backend.md)** - Backend-specific development guide
- **[Testing Guide](docs/development/testing.md)** - Testing requirements and best practices

### 💡 Areas Where We Need Help

- 🎨 Frontend UI/UX improvements
- 📱 Mobile-responsive design
- 🧪 Test coverage expansion
- 📝 Documentation improvements
- 🐛 Bug fixes and performance optimizations

## 💡 Helpful Tips

<details>
<summary><strong>🔧 Common Development Tasks</strong></summary>

### Resetting Your Development Environment
```bash
# Stop all services
pnpm dev:stop  # If available, or Ctrl+C

# Reset database
cd apps/backend && pnpm db:reset

# Clean node_modules and reinstall
pnpm store prune
rm -rf node_modules */node_modules
pnpm install

# Restart development
pnpm dev
```

### Database Management
```bash
# View your database in a GUI
cd apps/backend && pnpm db:studio

# Create a new migration
cd apps/backend && npx prisma migrate dev --name your-migration-name

# View migration status
cd apps/backend && npx prisma migrate status
```

### Troubleshooting
- **Port conflicts**: Check if ports 3000/3001 are already in use
- **Database issues**: Ensure PostgreSQL is running and accessible
- **Redis issues**: Ensure Redis is running on default port 6379
- **Environment issues**: Verify your `.env` files are properly configured

</details>

<details>
<summary><strong>🚀 Performance Tips</strong></summary>

### Development Performance
- Use `pnpm` instead of `npm` or `yarn` for faster installs
- Keep your PostgreSQL and Redis instances local for development
- Use `pnpm dev` to run all services in parallel
- Enable file watching in your IDE for hot reloading

### Production Readiness
- Always run `pnpm build` to check for build errors
- Run the full test suite with `pnpm test` before deploying
- Use `pnpm test:coverage` to ensure adequate test coverage
- Check the production build with `cd apps/frontend && pnpm preview`

</details>

## 📞 Support & Community

### 🐛 Found a Bug?
Please [open an issue](https://github.com/yourusername/asyncstand/issues/new/choose) with:
- Clear bug description
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)

### 💬 Need Help?
- 📖 Check our [documentation](docs/) first
- 🔍 Search [existing issues](https://github.com/yourusername/asyncstand/issues)
- 💡 Start a [discussion](https://github.com/yourusername/asyncstand/discussions) for questions
- 📧 Email us at: support@asyncstand.dev

### 🌟 Show Your Support
If this project helps you, please consider:
- ⭐ Starring the repository
- 🐦 Sharing on social media
- 💝 Contributing code or documentation

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ by the AsyncStand Team**

[![GitHub](https://img.shields.io/badge/GitHub-AsyncStand-181717.svg?style=flat-square&logo=github)](https://github.com/yourusername/asyncstand)
[![Twitter](https://img.shields.io/badge/Twitter-@AsyncStand-1DA1F2.svg?style=flat-square&logo=twitter&logoColor=white)](https://twitter.com/asyncstand)

</div>

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

---

## 🎥 Demo & Screenshots

> 📸 **Screenshots and demo videos coming soon!**  
> The application is currently in active development with the backend API fully functional.

### 🔧 Current Status

- ✅ **Backend API**: Fully implemented and tested
- 🚧 **Frontend UI**: Basic React starter with core components
- 📋 **Worker Jobs**: Planned for next development phase

### 📊 API Documentation

Explore the fully documented REST API at `http://localhost:3001/api` when running locally.

**Status**: 🟢 Active development - backend core complete, frontend and worker in planning phase.
