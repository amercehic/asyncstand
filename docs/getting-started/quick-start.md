# Quick Start Guide

Get AsyncStand up and running in under 5 minutes.

## Prerequisites

- **Node.js** 18+ (we recommend using [nvm](https://github.com/nvm-sh/nvm))
- **pnpm** 7+ (we use pnpm for package management)
- **Git**

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd asyncstand
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Setup environment**

   ```bash
   pnpm env:setup
   ```

4. **Start development servers**
   ```bash
   pnpm dev
   ```

## What's Running

After running `pnpm dev`, you'll have:

- **Backend API**: http://localhost:3000
- **Frontend App**: http://localhost:5173
- **Worker**: Running in background
- **Database**: SQLite (development)

## Verify Installation

1. **Check backend health**: http://localhost:3000/health
2. **Visit frontend**: http://localhost:5173
3. **Run tests**: `pnpm test:auth` or `pnpm test:e2e:backend`

## Next Steps

- Read the [Development Setup](./development-setup.md) for detailed configuration
- Check [Environment Configuration](./environment.md) for environment variables
- Explore [API Design](../architecture/api-design.md) for backend endpoints

## Troubleshooting

If you encounter issues:

1. **Clear cache**: `pnpm clean`
2. **Reinstall dependencies**: `rm -rf node_modules && pnpm install`
3. **Check logs**: Look for error messages in terminal output
4. **Verify Node version**: `node --version` (should be 18+)

For more help, see [Common Issues](../troubleshooting/common-issues.md).
