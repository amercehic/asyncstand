# AsyncStand Documentation

Welcome to the AsyncStand project documentation. This monorepo contains a full-stack application with backend, frontend, worker, and shared packages.

## 📚 Documentation Structure

### Getting Started

- [Project Overview](./overview.md) - High-level architecture and goals
- [Quick Start Guide](./getting-started/quick-start.md) - Get up and running in 5 minutes
- [Development Setup](./getting-started/development-setup.md) - Complete development environment setup
- [Environment Configuration](./getting-started/environment.md) - Environment variables and configuration

### Architecture & Design

- [System Architecture](./architecture/system-overview.md) - High-level system design
- [Database Schema](./architecture/database-schema.md) - Prisma schema and relationships
- [API Design](./architecture/api-design.md) - REST API specifications
- [Authentication Flow](./architecture/authentication.md) - JWT-based auth implementation

### Development Guides

- [Backend Development](./development/backend.md) - NestJS backend development
- [Frontend Development](./development/frontend.md) - React frontend development
- [Worker Development](./development/worker.md) - Background job processing
- [Shared Package](./development/shared.md) - Common utilities and types
- [Testing Strategy](./development/testing.md) - Unit, integration, and e2e testing

### Deployment & Operations

- [Deployment Guide](./deployment/deployment.md) - Production deployment instructions
- [Environment Management](./deployment/environments.md) - Staging, production, and local environments
- [Monitoring & Logging](./deployment/monitoring.md) - Application monitoring setup

### Contributing

- [Contributing Guidelines](./contributing/guidelines.md) - How to contribute to the project
- [Code Style Guide](./contributing/code-style.md) - Coding standards and conventions
- [Pull Request Process](./contributing/pull-requests.md) - PR workflow and review process

### Troubleshooting

- [Common Issues](./troubleshooting/common-issues.md) - Frequently encountered problems
- [Debugging Guide](./troubleshooting/debugging.md) - Debugging techniques and tools

## 🚀 Quick Commands

```bash
# Install dependencies
pnpm install

# Setup environment
pnpm env:setup

# Start development servers
pnpm dev

# Run tests
pnpm test
pnpm test:auth  # Run auth-specific tests

# Build for production
pnpm build

# Lint code
pnpm lint
```

## 📖 Additional Resources

- [API Reference](./api-reference.md) - Complete API documentation
- [Changelog](./changelog.md) - Version history and changes
- [Roadmap](./roadmap.md) - Future development plans
