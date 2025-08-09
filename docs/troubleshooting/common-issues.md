# Common Issues & Troubleshooting

This guide covers common issues you might encounter while developing or deploying AsyncStand and their solutions.

## Installation & Setup Issues

### Node.js and pnpm Issues

#### Issue: Command not found: pnpm

**Symptoms:**

```bash
pnpm: command not found
```

**Solutions:**

1. **Install pnpm globally:**

   ```bash
   npm install -g pnpm
   ```

2. **Use npm instead of pnpm (not recommended):**

   ```bash
   npm install
   npm run dev
   ```

3. **Use npx to run pnpm:**
   ```bash
   npx pnpm install
   npx pnpm dev
   ```

#### Issue: Wrong Node.js version

**Symptoms:**

```bash
error @nestjs/core@11.1.5: The engine "node" is incompatible with this module
```

**Solutions:**

1. **Check Node.js version:**

   ```bash
   node --version  # Should be 20.x.x or higher
   ```

2. **Use Node Version Manager:**

   ```bash
   # Install nvm
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

   # Install and use Node 20
   nvm install 20
   nvm use 20
   nvm alias default 20
   ```

3. **Download from nodejs.org:**
   - Visit https://nodejs.org/
   - Download and install Node.js 20.x LTS

### Database Issues

#### Issue: PostgreSQL connection refused

**Symptoms:**

```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions:**

1. **Check if PostgreSQL is running:**

   ```bash
   # macOS (Homebrew)
   brew services list | grep postgresql
   brew services start postgresql@14

   # Linux
   sudo systemctl status postgresql
   sudo systemctl start postgresql

   # Windows
   # Check Services app for PostgreSQL service
   ```

2. **Verify connection parameters:**

   ```bash
   # Test connection manually
   psql -U postgres -h localhost -p 5432

   # Check DATABASE_URL in .env file
   DATABASE_URL=postgresql://user:pass@localhost:5432/asyncstand
   ```

3. **Create database if it doesn't exist:**
   ```bash
   psql -U postgres
   CREATE DATABASE asyncstand;
   CREATE USER asyncstand_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE asyncstand TO asyncstand_user;
   \q
   ```

#### Issue: Database migration fails

**Symptoms:**

```bash
Error: Migration failed to apply cleanly to the shadow database
```

**Solutions:**

1. **Reset database (development only):**

   ```bash
   cd apps/backend
   pnpm db:reset
   pnpm db:migrate
   ```

2. **Check for migration conflicts:**

   ```bash
   pnpm db:status
   ```

3. **Manual migration fix:**

   ```bash
   # Delete problematic migration
   rm prisma/migrations/[migration-name]

   # Create new migration
   pnpm db:migrate --name fix-migration
   ```

### Redis Issues

#### Issue: Redis connection failed

**Symptoms:**

```bash
Error: Redis connection to 127.0.0.1:6379 failed - connect ECONNREFUSED
```

**Solutions:**

1. **Start Redis server:**

   ```bash
   # macOS (Homebrew)
   brew services start redis

   # Linux
   sudo systemctl start redis-server

   # Manual start
   redis-server
   ```

2. **Test Redis connection:**

   ```bash
   redis-cli ping  # Should return PONG
   ```

3. **Check Redis configuration:**

   ```bash
   # Check if Redis is listening on correct port
   redis-cli -p 6379 ping

   # Check REDIS_URL in .env
   REDIS_URL=redis://localhost:6379
   ```

## Development Issues

### Port Conflicts

#### Issue: Port already in use

**Symptoms:**

```bash
Error: listen EADDRINUSE: address already in use :::3001
```

**Solutions:**

1. **Find and kill process using port:**

   ```bash
   # Find process
   lsof -i :3001

   # Kill process
   kill -9 <PID>
   ```

2. **Use different port:**

   ```bash
   PORT=3002 pnpm dev
   ```

3. **Kill all Node processes:**
   ```bash
   pkill -f node
   ```

### Environment Configuration

#### Issue: Environment variables not loaded

**Symptoms:**

```bash
JWT_SECRET is required
Environment validation failed
```

**Solutions:**

1. **Check .env file exists:**

   ```bash
   ls -la apps/backend/.env
   ```

2. **Copy from example:**

   ```bash
   cp apps/backend/.env.example apps/backend/.env
   ```

3. **Verify file format:**

   ```bash
   # Correct format
   JWT_SECRET=your-secret-key

   # Incorrect format (no spaces around =)
   JWT_SECRET = your-secret-key  # Wrong
   ```

4. **Check file permissions:**
   ```bash
   chmod 600 apps/backend/.env
   ```

### TypeScript Issues

#### Issue: TypeScript compilation errors

**Symptoms:**

```bash
error TS2307: Cannot find module '@/auth/auth.service'
```

**Solutions:**

1. **Clear TypeScript cache:**

   ```bash
   rm -rf node_modules/.cache
   rm -rf apps/backend/dist
   pnpm build
   ```

2. **Check path mapping in tsconfig.json:**

   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```

3. **Restart TypeScript service in VS Code:**
   - `Ctrl/Cmd + Shift + P`
   - Type "TypeScript: Restart TS Server"

### Prisma Issues

#### Issue: Prisma client out of sync

**Symptoms:**

```bash
@prisma/client did not initialize correctly
```

**Solutions:**

1. **Regenerate Prisma client:**

   ```bash
   cd apps/backend
   pnpm db:generate
   ```

2. **Reinstall Prisma:**
   ```bash
   pnpm remove @prisma/client prisma
   pnpm add @prisma/client
   pnpm add -D prisma
   pnpm db:generate
   ```

## Testing Issues

### Test Failures

#### Issue: Tests timeout or hang

**Symptoms:**

```bash
Test suite failed to run
Jest did not exit one second after the test run completed
```

**Solutions:**

1. **Increase timeout:**

   ```bash
   pnpm test --testTimeout=30000
   ```

2. **Check for open handles:**

   ```bash
   pnpm test --detectOpenHandles
   ```

3. **Close database connections in tests:**
   ```typescript
   afterAll(async () => {
     await app.close();
     await prisma.$disconnect();
   });
   ```

#### Issue: Test database conflicts

**Symptoms:**

```bash
Database "asyncstand_test" is being accessed by other users
```

**Solutions:**

1. **Use unique test database:**

   ```bash
   # In test configuration
   DATABASE_URL=postgresql://user:pass@localhost:5432/asyncstand_test_${Math.random()}
   ```

2. **Run tests sequentially:**

   ```bash
   pnpm test --runInBand
   ```

3. **Clear test database:**
   ```bash
   cd apps/backend
   NODE_ENV=test pnpm db:reset
   ```

## Production Issues

### SSL/TLS Issues

#### Issue: SSL certificate errors

**Symptoms:**

```bash
Error: unable to verify the first certificate
```

**Solutions:**

1. **Use proper SSL certificates:**

   ```bash
   # Let's Encrypt
   certbot --nginx -d yourdomain.com
   ```

2. **Update Node.js for better SSL support:**

   ```bash
   node --version  # Ensure using latest LTS
   ```

3. **Configure SSL properly in nginx:**
   ```nginx
   server {
     listen 443 ssl;
     ssl_certificate /path/to/cert.pem;
     ssl_certificate_key /path/to/key.pem;
   }
   ```

### Performance Issues

#### Issue: Slow API responses

**Symptoms:**

- API responses take > 5 seconds
- Database queries timing out

**Solutions:**

1. **Check database indexes:**

   ```sql
   EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
   ```

2. **Add database indexes:**

   ```prisma
   model User {
     email String @unique @db.VarChar(255)

     @@index([email])
   }
   ```

3. **Enable query logging:**

   ```typescript
   // In PrismaService
   constructor() {
     super({
       log: ['query', 'slow_query'],
     });
   }
   ```

4. **Check Redis performance:**
   ```bash
   redis-cli --latency
   ```

#### Issue: High memory usage

**Symptoms:**

```bash
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Solutions:**

1. **Increase Node.js memory limit:**

   ```bash
   node --max-old-space-size=4096 dist/main.js
   ```

2. **Check for memory leaks:**

   ```bash
   # Use clinic.js or 0x for profiling
   npx clinic doctor -- node dist/main.js
   ```

3. **Optimize database queries:**
   ```typescript
   // Avoid loading all relations
   const users = await prisma.user.findMany({
     select: {
       id: true,
       email: true,
       // Don't load heavy relations unless needed
     },
   });
   ```

## Deployment Issues

### Docker Issues

#### Issue: Docker build fails

**Symptoms:**

```bash
ERROR [stage 1/3] failed to solve with frontend dockerfile.v0
```

**Solutions:**

1. **Check Dockerfile syntax:**

   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   EXPOSE 3001
   CMD ["node", "dist/main.js"]
   ```

2. **Build with verbose output:**

   ```bash
   docker build --progress=plain -t asyncstand .
   ```

3. **Check .dockerignore:**
   ```
   node_modules
   npm-debug.log
   .env
   .git
   ```

### Environment-Specific Issues

#### Issue: Different behavior in production

**Solutions:**

1. **Use same Node.js version:**

   ```json
   // package.json
   {
     "engines": {
       "node": "20.x",
       "npm": "10.x"
     }
   }
   ```

2. **Check environment variables:**

   ```bash
   # Compare development and production .env files
   diff apps/backend/.env apps/backend/.env.production
   ```

3. **Enable production logging:**
   ```bash
   LOG_LEVEL=debug NODE_ENV=production node dist/main.js
   ```

## Integration Issues

### Slack Integration

#### Issue: Slack OAuth fails

**Symptoms:**

```bash
OAuth error: invalid_client_id
```

**Solutions:**

1. **Verify Slack app configuration:**
   - Check Client ID and Secret in Slack app settings
   - Verify redirect URI matches your backend URL

2. **Check environment variables:**

   ```bash
   echo $SLACK_CLIENT_ID
   echo $SLACK_CLIENT_SECRET
   ```

3. **Update Slack app settings:**
   - OAuth & Permissions → Redirect URLs
   - Should match: `https://yourapi.com/integrations/slack/oauth/callback`

#### Issue: Slack webhook verification fails

**Symptoms:**

```bash
Slack signature verification failed
```

**Solutions:**

1. **Check signing secret:**

   ```bash
   echo $SLACK_SIGNING_SECRET
   ```

2. **Verify webhook URL:**
   - Should be publicly accessible
   - Should use HTTPS in production

3. **Check timestamp validation:**

   ```typescript
   // Verify timestamp is within 5 minutes
   const timestamp = request.headers['x-slack-request-timestamp'];
   const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;

   if (timestamp < fiveMinutesAgo) {
     throw new Error('Request timestamp too old');
   }
   ```

### Email Integration

#### Issue: Email sending fails

**Symptoms:**

```bash
Error: Invalid login: 535 Authentication failed
```

**Solutions:**

1. **Check SMTP credentials:**

   ```bash
   # Test SMTP connection
   telnet smtp.gmail.com 587
   ```

2. **Use app passwords for Gmail:**
   - Enable 2FA
   - Generate app password
   - Use app password instead of regular password

3. **Verify SMTP settings:**
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false  # Use STARTTLS
   ```

## Debugging Techniques

### Logging

#### Enable Debug Logging

```bash
# Backend
LOG_LEVEL=debug pnpm dev

# Specific module
DEBUG=app:auth pnpm dev

# All modules
DEBUG=* pnpm dev
```

#### Structured Logging

```typescript
import { Logger } from '@nestjs/common';

export class MyService {
  private readonly logger = new Logger(MyService.name);

  async troubleshootMethod() {
    this.logger.debug('Method started', { context: 'troubleshoot' });

    try {
      // Your code here
    } catch (error) {
      this.logger.error('Method failed', {
        error: error.message,
        stack: error.stack,
        context: 'troubleshoot',
      });
      throw error;
    }
  }
}
```

### Network Debugging

#### Check API Endpoints

```bash
# Test health endpoint
curl -v http://localhost:3001/health

# Test with authentication
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/users

# Check CORS
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:3001/api/auth/login
```

#### Database Debugging

```bash
# Check database connections
psql -U asyncstand_user -d asyncstand -c "SELECT count(*) FROM \"User\";"

# Monitor slow queries
tail -f /var/log/postgresql/postgresql-14-main.log | grep "slow query"
```

## Getting Additional Help

### Information to Gather

When seeking help, provide:

1. **Environment details:**

   ```bash
   node --version
   pnpm --version
   psql --version
   redis-server --version
   ```

2. **Error messages:**
   - Full error stack trace
   - Console output
   - Log files

3. **Steps to reproduce:**
   - What were you trying to do?
   - What commands did you run?
   - What was the expected result?

4. **Configuration:**
   - Environment variables (without secrets)
   - Package.json dependencies
   - System information

### Support Channels

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general help
- **Documentation**: Check existing docs for solutions
- **Community**: Ask on Stack Overflow with tag `asyncstand`

### Creating Bug Reports

Use this template:

```markdown
## Bug Description

Clear description of the bug

## Steps to Reproduce

1. Step one
2. Step two
3. Step three

## Expected Behavior

What should happen

## Actual Behavior

What actually happens

## Environment

- OS: [e.g., macOS 13.0]
- Node.js: [e.g., 20.5.0]
- pnpm: [e.g., 10.12.4]
- Database: [e.g., PostgreSQL 14.2]

## Additional Context

Any other relevant information
```

---

This troubleshooting guide covers the most common issues. If you encounter a problem not listed here, please check the documentation or create an issue on GitHub.
