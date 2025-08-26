# Security Setup for Render Deployment

## Quick Protection Methods

### 1. Basic Authentication (Backend)
- Set these in Render Dashboard > Environment:
  - `BASIC_AUTH_ENABLED`: `true`
  - `BASIC_AUTH_USERNAME`: your-username
  - `BASIC_AUTH_PASSWORD`: your-password
- This will require login for all API endpoints except /health

### 2. Frontend Password Protection
- Set in Render Dashboard > Frontend Environment:
  - `VITE_APP_PASSWORD`: your-frontend-password
- Users will need to enter this password to access the app

### 3. Make Repository Private
- Go to GitHub > Settings > General
- Change visibility to Private
- This prevents others from seeing your code

### 4. Use Random URLs (Security through Obscurity)
- Rename your services in render.yaml to something unguessable:
  - Instead of: `asyncstand-backend-prod`
  - Use: `project-x7k9m2-backend-prod`

### 5. Cloudflare Protection (Advanced)
1. Add your domain to Cloudflare
2. Enable "Under Attack Mode" or "Bot Fight Mode"
3. Set up Cloudflare Access for zero-trust security
4. Use Cloudflare WAF rules to block unwanted traffic

### 6. API Rate Limiting
Already implemented in your backend:
- Short window: 20 requests/second
- Medium window: 200 requests/minute  
- Long window: 2000 requests/hour

## Implementation Steps

### For Basic Protection (Recommended):
1. Go to Render Dashboard
2. Select your backend service
3. Go to Environment tab
4. Add:
   ```
   BASIC_AUTH_ENABLED=true
   BASIC_AUTH_USERNAME=admin
   BASIC_AUTH_PASSWORD=<generate-strong-password>
   ```
5. Save and deploy

### For Frontend Protection:
1. Update App.tsx to wrap with PasswordProtection component
2. Set VITE_APP_PASSWORD in Render environment
3. Rebuild and deploy

## Security Best Practices

1. **Never commit secrets** - Use environment variables
2. **Use strong passwords** - Generate with: `openssl rand -base64 32`
3. **Enable 2FA** on GitHub and Render accounts
4. **Monitor logs** regularly for suspicious activity
5. **Keep dependencies updated** - Run `pnpm audit` regularly

## Emergency Lockdown

If you suspect unauthorized access:
1. Immediately set `BASIC_AUTH_ENABLED=true` in Render
2. Rotate all passwords and JWT secrets
3. Review access logs in Render dashboard
4. Consider temporarily scaling down to 0 instances