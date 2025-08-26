# Railway Deployment Guide

## Prerequisites
- Railway CLI installed: `npm i -g @railway/cli`
- GitHub repository connected
- Railway account with Pro plan for staging + production

## Setup Steps

### 1. Create Railway Projects

```bash
# Login to Railway
railway login

# Create staging project
railway init --name asyncstand-staging
cd asyncstand-staging
railway add --plugin postgresql
railway add --plugin redis

# Create production project
railway init --name asyncstand-production
cd asyncstand-production
railway add --plugin postgresql
railway add --plugin redis
```

### 2. Configure Services

In Railway Dashboard for each project:

**Backend Service:**
- Source: GitHub Repo
- Build Command: Docker
- Dockerfile Path: `apps/backend/Dockerfile.railway`
- Start Command: `node dist/src/main.js`

**Frontend Service:**
- Source: GitHub Repo
- Build Command: Docker
- Dockerfile Path: `apps/frontend/Dockerfile.railway`
- Environment Variable: `VITE_API_URL=${{RAILWAY_BACKEND_URL}}`

### 3. Set Environment Variables

**Backend service variables:**
- `NODE_ENV`: staging/production
- `DATABASE_URL`: `${{DATABASE_URL}}`
- `REDIS_URL`: `${{REDIS_URL}}`
- `JWT_SECRET`: [generate secure secret]
- `FRONTEND_URL`: `${{RAILWAY_FRONTEND_URL}}`

**Frontend service variables:**
- `VITE_API_URL`: `${{RAILWAY_BACKEND_URL}}`
- `VITE_APP_NAME`: AsyncStand

### 4. Deploy

```bash
# Deploy to staging
git push origin staging

# Deploy to production
git push origin main
```

## Troubleshooting

**Issue: Module not found**
- Ensure Dockerfile paths are correct
- Check pnpm workspace configuration

**Issue: Database connection failed**
- Verify DATABASE_URL environment variable
- Check VPC/network configuration

**Issue: Frontend can't reach backend**
- Ensure VITE_API_URL uses public Railway URL
- Check CORS configuration in backend

## Verification Steps

After creating all files, verify:

1. **Docker builds locally**:
   ```bash
   docker build -f apps/backend/Dockerfile.railway -t test-backend .
   ```

2. **Environment files exist**:
   ```bash
   ls -la .env.staging .env.production
   ```

3. **Railway CLI works**:
   ```bash
   railway --version
   ```

4. **All TypeScript builds**:
   ```bash
   pnpm build
   ```

## Expected Result

After completing all tasks, you should have:
- Working Docker configurations for both backend and frontend
- Railway deployment configuration
- Staging and production environment setups
- GitHub Actions CI/CD pipeline
- Local docker-compose for testing
- Complete deployment documentation

The deployment should work by pushing to the staging or main branches, automatically building Docker images and deploying to Railway.

## Important Notes

- Replace all placeholder values (Slack credentials, SMTP settings, JWT secrets) with actual values
- Generate secure random strings for JWT_SECRET in production
- Test locally with docker-compose before deploying
- Set up Railway project secrets in the dashboard, not in code
- Ensure PostgreSQL and Redis plugins are added before deploying

Complete these tasks in order, testing each step before proceeding to the next.