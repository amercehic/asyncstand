# Environment Configuration

This guide covers environment variables for AsyncStand applications based on current implementation.

## Environment Files

AsyncStand uses environment-specific `.env` files:

```
apps/backend/.env          # Backend configuration (✅ Implemented)
apps/frontend/.env         # Frontend configuration (🚧 Basic setup)
apps/worker/.env           # Worker configuration (🚧 Planned)
```

## Backend Environment Variables

### Core Configuration

#### NODE_ENV

- **Description**: Application environment
- **Type**: `string`
- **Required**: No
- **Default**: `development`
- **Valid Values**: `development`, `production`, `test`

```bash
NODE_ENV=development
```

#### PORT

- **Description**: HTTP server port
- **Type**: `number`
- **Required**: No
- **Default**: `3000`

```bash
PORT=3001
```

#### DATABASE_URL

- **Description**: PostgreSQL connection string
- **Type**: `string`
- **Required**: Yes
- **Format**: `postgresql://[user[:password]@][host][:port][/dbname]`

```bash
# Development
DATABASE_URL=postgresql://asyncstand_user:password@localhost:5432/asyncstand

# Production (example)
DATABASE_URL=postgresql://user:pass@prod-db.amazonaws.com:5432/asyncstand_prod
```

### Authentication

#### JWT_SECRET

- **Description**: Secret key for JWT token signing
- **Type**: `string`
- **Required**: Yes
- **Security**: Use 256-bit random string in production

```bash
JWT_SECRET=your-super-secret-jwt-key-here
```

#### FRONTEND_URL

- **Description**: Frontend application URL for CORS and redirects
- **Type**: `string`
- **Required**: No
- **Default**: `http://localhost:3000`

```bash
# Development (default)
FRONTEND_URL=http://localhost:3000
```

### Email Configuration

#### FROM_EMAIL

- **Description**: Default sender email address
- **Type**: `string`
- **Required**: No
- **Default**: `noreply@asyncstand.com`

```bash
FROM_EMAIL=noreply@yourdomain.com
```

#### SMTP_HOST

- **Description**: SMTP server hostname
- **Type**: `string`
- **Required**: No
- **Default**: `""` (empty)

```bash
SMTP_HOST=smtp.gmail.com
```

#### SMTP_PORT

- **Description**: SMTP server port
- **Type**: `number`
- **Required**: No
- **Default**: `587`

```bash
SMTP_PORT=587
```

#### SMTP_USER

- **Description**: SMTP authentication username
- **Type**: `string`
- **Required**: No
- **Default**: `""` (empty)

```bash
SMTP_USER=your-email@gmail.com
```

#### SMTP_PASS

- **Description**: SMTP authentication password
- **Type**: `string`
- **Required**: No
- **Default**: `""` (empty)

```bash
SMTP_PASS=your-app-password
```

### Slack Integration

#### SLACK_CLIENT_ID

- **Description**: Slack OAuth application client ID
- **Type**: `string`
- **Required**: No (required for Slack integration)
- **Default**: `""` (empty)

```bash
SLACK_CLIENT_ID=123456789.987654321
```

#### SLACK_CLIENT_SECRET

- **Description**: Slack OAuth application client secret
- **Type**: `string`
- **Required**: No (required for Slack integration)
- **Default**: `""` (empty)

```bash
SLACK_CLIENT_SECRET=your-slack-client-secret
```

#### SLACK_OAUTH_ENABLED

- **Description**: Enable/disable Slack OAuth functionality
- **Type**: `string`
- **Required**: No
- **Default**: `false`
- **Valid Values**: `true`, `false`

```bash
SLACK_OAUTH_ENABLED=true
```

### Redis Configuration

#### REDIS_URL

- **Description**: Redis connection string
- **Type**: `string`
- **Required**: No
- **Default**: `redis://localhost:6379`

```bash
# Development
REDIS_URL=redis://localhost:6379

# Production with auth
REDIS_URL=redis://:password@redis-host:6379

# Redis Cloud
REDIS_URL=rediss://username:password@host:port
```

### Logging

#### LOG_LEVEL

- **Description**: Minimum log level to output
- **Type**: `string`
- **Required**: No
- **Default**: `debug`
- **Valid Values**: `fatal`, `error`, `warn`, `info`, `debug`, `trace`

```bash
# Development
LOG_LEVEL=debug

# Production
LOG_LEVEL=info
```

#### LOG_PRETTY

- **Description**: Enable pretty-printed logs (development)
- **Type**: `string`
- **Required**: No
- **Default**: `true`
- **Valid Values**: `true`, `false`

```bash
# Development
LOG_PRETTY=true

# Production
LOG_PRETTY=false
```

### Security

#### DATABASE_ENCRYPT_KEY

- **Description**: Key for encrypting sensitive database fields
- **Type**: `string`
- **Required**: No (required for encryption features)
- **Default**: `""` (empty)
- **Security**: Use 32-character random string

```bash
DATABASE_ENCRYPT_KEY=your-32-character-encryption-key
```

## Frontend Environment Variables

### Basic Configuration (Vite)

#### VITE_API_URL

- **Description**: Backend API base URL
- **Type**: `string`
- **Required**: No
- **Default**: `http://localhost:3001`

```bash
# Development (default)
VITE_API_URL=http://localhost:3001
```

## Worker Environment Variables

Currently planned - worker application is not yet implemented.

## Complete Example Files

### Development Configuration

#### `apps/backend/.env`

```bash
# Core
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://asyncstand_user:password@localhost:5432/asyncstand

# Authentication
JWT_SECRET=your-development-jwt-secret-key
FRONTEND_URL=http://localhost:3000

# Email (optional for development)
FROM_EMAIL=dev@asyncstand.local
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Slack Integration (optional)
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_OAUTH_ENABLED=false

# Redis
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=debug
LOG_PRETTY=true

# Security
DATABASE_ENCRYPT_KEY=development-encryption-key-32chars
```

#### `apps/frontend/.env`

```bash
VITE_API_URL=http://localhost:3001
```

### Production Configuration Example

_Note: This is for reference only - modify for your actual production environment_

```bash
# Core
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://your_prod_user:password@your_db_host:5432/asyncstand

# Authentication
JWT_SECRET=your-secure-production-jwt-secret
FRONTEND_URL=http://your-frontend-url

# Email
FROM_EMAIL=noreply@yourdomain.com
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-smtp-password

# Slack Integration
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_OAUTH_ENABLED=true

# Redis
REDIS_URL=redis://your-redis-host:6379

# Logging
LOG_LEVEL=info
LOG_PRETTY=false

# Security
DATABASE_ENCRYPT_KEY=your-32-char-encryption-key
```

## Environment Validation

The backend application validates all environment variables on startup using `class-validator`. Invalid configuration will prevent the application from starting.

### Validation Rules

- **Required fields** must be present and non-empty
- **Numeric fields** are automatically converted and validated
- **Enum fields** must match allowed values
- **URL fields** are validated for proper format

## Security Best Practices

### Secrets Management

1. **Never commit `.env` files** to version control
2. **Use different secrets** for each environment
3. **Rotate secrets regularly** in production
4. **Use secret management services** (AWS Secrets Manager, Azure Key Vault)

### JWT Security

```bash
# Generate secure JWT secret (Linux/macOS)
openssl rand -hex 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Database Security

- Use **dedicated database users** with minimal privileges
- Enable **SSL/TLS connections** in production
- Use **connection pooling** and **read replicas** for scalability

### Redis Security

- Enable **authentication** in production
- Use **SSL/TLS connections** (rediss://)
- Configure **appropriate timeouts** and **memory limits**

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions:**

1. Verify PostgreSQL is running
2. Check DATABASE_URL format
3. Ensure database and user exist
4. Verify network connectivity

#### Redis Connection Errors

```bash
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solutions:**

1. Verify Redis is running
2. Check REDIS_URL format
3. Verify Redis authentication if enabled

#### Validation Errors

```bash
Error: An instance of EnvironmentVariables has failed the validation
```

**Solutions:**

1. Check required environment variables are set
2. Verify data types (numbers, booleans)
3. Check enum values match allowed options

### Getting Help

If you encounter issues with environment configuration:

1. Check the [troubleshooting guide](../troubleshooting/common-issues.md)
2. Verify your `.env` file syntax
3. Review application logs for specific error messages
4. Ensure all prerequisites are installed and running

## Notes

- Environment variables are loaded once at application startup
- Changes require application restart
- Use `.env.example` files as templates
- Frontend environment variables must be prefixed with `VITE_`
- Worker environment variables will be documented when implemented
