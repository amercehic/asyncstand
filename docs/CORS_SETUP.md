# CORS Configuration Guide

## Overview

This document describes the CORS (Cross-Origin Resource Sharing) setup for the AsyncStand application, providing a secure and flexible configuration for both development and production environments.

## Architecture

### Backend CORS Configuration

The backend uses a centralized `CorsConfig` class (`apps/backend/src/config/cors.config.ts`) that:

- Reads configuration from environment variables
- Supports both exact origin matching and wildcard patterns
- Provides environment-specific defaults
- Logs configuration for debugging
- Caches preflight responses for 24 hours

### Frontend Development Proxy

In development, Vite proxies API requests to avoid CORS issues:

- All `/api/*`, `/auth/*`, and `/health` requests are proxied to the backend
- No CORS headers needed in development
- Frontend uses relative URLs (e.g., `/api/users` instead of `http://localhost:3001/api/users`)

## Configuration

### Environment Variables

#### Backend (.env)

```bash
# Frontend URL (required for production)
FRONTEND_URL=https://asyncstand-frontend-prod.onrender.com

# Additional allowed origins (optional, comma-separated)
CORS_ALLOWED_ORIGINS=https://example.com,https://app.example.com

# Additional origin patterns (optional, comma-separated regex)
CORS_ALLOWED_PATTERNS=^https://.*\.example\.com$

# Ngrok URL for development tunneling (optional)
NGROK_URL=https://your-subdomain.ngrok-free.app
```

#### Frontend (.env)

```bash
# Backend API URL (only used in production builds)
VITE_API_URL=https://asyncstand-backend-prod.onrender.com
```

## Default Behavior

### Development Mode

- Allows: `http://localhost:5173`, `http://localhost:3000`, `http://127.0.0.1:5173`
- Supports ngrok tunnels automatically
- Vite proxy handles API requests (no CORS needed)

### Production Mode

- Allows configured `FRONTEND_URL`
- Allows Render deployment URLs:
  - `https://asyncstand-frontend-prod.onrender.com`
  - `https://asyncstand-frontend-staging.onrender.com`
  - Preview deployments matching pattern `https://asyncstand-frontend*.onrender.com`
- Backend origins allowed for Swagger UI access

## Security Features

### Credentials Support

- `credentials: true` enables cookies and authorization headers
- Never combines with wildcard (`*`) origins for security

### Allowed Headers

- Standard headers: `Content-Type`, `Authorization`, `X-Requested-With`
- CSRF protection: `X-CSRF-Token`, `X-XSRF-TOKEN`
- Session management: `X-Session-Id`
- Ngrok support: `ngrok-skip-browser-warning`

### Exposed Headers

- Request tracking: `X-Request-Id`, `X-Correlation-Id`
- Rate limiting: `X-RateLimit-*` headers

### Preflight Caching

- `maxAge: 86400` (24 hours) reduces preflight requests

## Authentication Patterns

### JWT in Headers

```typescript
// Frontend API client
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'development' ? '' : import.meta.env.VITE_API_URL,
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

### Cookies/Sessions

```typescript
// Frontend API client with credentials
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'development' ? '' : import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// Backend cookie configuration
response.cookie('session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

## Production Deployment Options

### Option 1: Same-Origin (Recommended)

Serve both frontend and backend from the same domain using a reverse proxy:

#### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name asyncstand.com;

    # Frontend (default)
    location / {
        proxy_pass http://frontend:5173;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Option 2: Cross-Origin with Strict Allowlist

When separate domains are required:

1. Configure backend with specific allowed origins:

```bash
FRONTEND_URL=https://app.asyncstand.com
CORS_ALLOWED_ORIGINS=https://admin.asyncstand.com
```

2. Frontend uses absolute URLs in production:

```typescript
const API_URL = import.meta.env.DEV
  ? '' // Use proxy in development
  : import.meta.env.VITE_API_URL; // Use absolute URL in production
```

## Troubleshooting

### Common Issues

1. **CORS errors in development**
   - Ensure Vite proxy is configured correctly
   - Check that backend is running on expected port
   - Use relative URLs in frontend API calls

2. **CORS errors in production**
   - Verify `FRONTEND_URL` is set correctly in backend
   - Check that origin is in allowed list or matches patterns
   - Ensure credentials are handled correctly

3. **Preflight failures**
   - Check that OPTIONS method is allowed
   - Verify all required headers are in `allowedHeaders`
   - Check backend logs for rejected origins

### Debug Mode

The `CorsConfig` class logs configuration on startup:

```
🔒 CORS Configuration:
   Environment: production
   Allowed Origins: https://asyncstand-frontend-prod.onrender.com
   Pattern Matchers: 2 patterns configured
```

Rejected origins are logged as warnings:

```
⚠️ CORS rejected origin: https://unauthorized-site.com
```

## Best Practices

1. **Use same-origin in production when possible** - Eliminates CORS complexity
2. **Never use wildcard (`*`) with credentials** - Major security risk
3. **Keep allowed origins minimal** - Only add what's necessary
4. **Use environment variables** - Never hardcode origins
5. **Cache preflight responses** - Reduces latency
6. **Log CORS rejections** - Helps with debugging
7. **Use HTTPS in production** - Required for secure cookies
8. **Implement CSRF protection** - Especially with cookies/sessions

## Testing

### Local Testing

```bash
# Start backend
cd apps/backend
pnpm dev

# Start frontend with proxy
cd apps/frontend
pnpm dev

# Test CORS directly
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     http://localhost:3001/api/health
```

### Production Testing

```bash
# Test from allowed origin
curl -H "Origin: https://asyncstand-frontend-prod.onrender.com" \
     https://asyncstand-backend-prod.onrender.com/api/health

# Test from disallowed origin (should fail)
curl -H "Origin: https://evil-site.com" \
     https://asyncstand-backend-prod.onrender.com/api/health
```

## Migration Guide

### From Hardcoded Origins to Dynamic Configuration

1. Remove hardcoded CORS setup from `main.ts`
2. Add `CorsConfig` class to handle configuration
3. Update environment variables
4. Test with various origins
5. Deploy and verify

### Adding New Origins

1. For exact matches: Add to `CORS_ALLOWED_ORIGINS`
2. For patterns: Add regex to `CORS_ALLOWED_PATTERNS`
3. Restart backend to apply changes
4. Test from new origin

## Security Checklist

- [ ] CORS origins are restricted to known domains
- [ ] Credentials are only enabled when necessary
- [ ] HTTPS is used in production
- [ ] CSRF protection is implemented
- [ ] Sensitive operations require additional verification
- [ ] CORS rejections are logged and monitored
- [ ] Regular security audits are performed
- [ ] Environment variables are properly secured
