# Railway Deployment Guide

This guide explains how to deploy AsyncStand to Railway with staging and production environments.

## Prerequisites

1. Railway account (https://railway.app)
2. GitHub repository connected to Railway
3. PostgreSQL and Redis add-ons in Railway

## Project Structure

Railway will detect this as a monorepo and can deploy both frontend and backend services from the same repository.

## Deployment Steps

### 1. Initial Setup

1. **Create a New Project in Railway**
   - Go to Railway dashboard
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

2. **Add Database and Redis**
   - In your Railway project, click "New"
   - Add PostgreSQL database
   - Add Redis instance
   - Railway will automatically provide DATABASE_URL and REDIS_URL

### 2. Configure Services

Railway should automatically detect the monorepo structure. If not, manually create two services:

#### Backend Service

- **Root Directory**: `/`
- **Build Command**: `pnpm install --frozen-lockfile && pnpm --filter backend build`
- **Start Command**: `cd apps/backend && pnpm start:prod`
- **Port**: Railway will auto-detect from your app
- **Health Check Path**: `/health`

#### Frontend Service

- **Root Directory**: `/`
- **Build Command**: `pnpm install --frozen-lockfile && pnpm --filter frontend build`
- **Start Command**: `cd apps/frontend && pnpm preview --host 0.0.0.0 --port ${PORT:-3000}`

### 3. Environment Variables

Copy variables from `.env.railway.example` to each service:

#### Backend Variables (Required)

```
NODE_ENV=production
DATABASE_URL=[auto-provided by Railway]
REDIS_URL=[auto-provided by Railway]
JWT_SECRET=[generate secure random string]
JWT_REFRESH_SECRET=[generate secure random string]
FRONTEND_URL=https://your-frontend.railway.app
APP_URL=https://your-backend.railway.app
SMTP_HOST=[your SMTP host]
SMTP_PORT=[your SMTP port]
SMTP_USER=[your SMTP user]
SMTP_PASSWORD=[your SMTP password]
EMAIL_FROM=noreply@asyncstand.com
```

#### Frontend Variables (Required)

```
VITE_API_BASE_URL=https://your-backend.railway.app
VITE_APP_ENV=production
```

### 4. Setting Up Environments

#### Production Environment

- Deploy from `main` branch
- Use production database and Redis instances
- Set NODE_ENV=production

#### Staging Environment

1. Create a new Railway environment:
   - In project settings, add a "staging" environment
   - Configure to deploy from `staging` branch

2. Add separate resources:
   - Create new PostgreSQL instance for staging
   - Create new Redis instance for staging
   - Use different Slack workspace/tokens

3. Update environment variables:
   - Use staging URLs for APP_URL and FRONTEND_URL
   - Point to staging database and Redis

### 5. Database Migrations

After first deployment, run migrations:

```bash
# Connect to Railway CLI
railway login
railway link

# Run migrations in production
railway run --service=backend pnpm --filter backend db:migrate:deploy

# Seed database (optional, for initial setup)
railway run --service=backend pnpm --filter backend db:seed
```

### 6. Custom Domains (Optional)

1. Go to service settings in Railway
2. Navigate to "Networking" tab
3. Add your custom domain
4. Update DNS records as instructed
5. Update environment variables with new URLs

## Deployment Workflow

### For Production

```bash
# Ensure everything works locally
pnpm install
pnpm build
pnpm test

# Commit and push to main
git add .
git commit -m "Deploy to production"
git push origin main
```

### For Staging

```bash
# Create/update staging branch
git checkout -b staging
git push origin staging
```

## Monitoring

- View logs in Railway dashboard
- Each service has its own logs
- Set up alerts for service health

## Rollback

If something goes wrong:

1. Go to Railway dashboard
2. Select the service
3. Go to "Deployments" tab
4. Click on a previous successful deployment
5. Click "Redeploy"

## Troubleshooting

### Build Failures

- Check build logs in Railway
- Ensure all dependencies are in package.json
- Verify Node version compatibility

### Runtime Errors

- Check runtime logs
- Verify all environment variables are set
- Ensure database migrations ran successfully

### Connection Issues

- Verify CORS settings match your domains
- Check that frontend points to correct backend URL
- Ensure health checks are passing

## Cost Optimization

- Use Railway's usage-based pricing
- Scale down staging environment when not in use
- Monitor resource usage in Railway dashboard
- Consider using Railway's sleep feature for staging

## Security Notes

- Never commit `.env` files
- Rotate secrets regularly
- Use Railway's secret management
- Enable 2FA on Railway account
- Restrict deployment permissions to team leads
