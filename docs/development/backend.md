# Backend Development Guide

This guide covers development practices for the NestJS backend application.

## 🏗️ Project Structure

```
apps/backend/
├── src/
│   ├── auth/              # Authentication module
│   │   ├── dto/           # Data transfer objects
│   │   ├── validators/    # Custom validators
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   └── jwt.strategy.ts
│   ├── common/            # Shared utilities
│   │   ├── api-error.ts
│   │   └── http-exception.filter.ts
│   ├── config/            # Configuration
│   │   └── env.ts
│   ├── prisma/            # Database layer
│   │   ├── schema.prisma
│   │   └── prisma.service.ts
│   ├── app.controller.ts
│   ├── app.service.ts
│   ├── app.module.ts
│   └── main.ts
├── test/                  # E2E tests
│   ├── auth.e2e-spec.ts
│   └── app.e2e-spec.ts
├── prisma/
│   ├── migrations/        # Database migrations
│   └── schema.prisma      # Database schema
├── jest-e2e.json         # Jest configuration
└── package.json
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- SQLite (development) or PostgreSQL (production)

### Development Commands

```bash
# Install dependencies
pnpm install

# Setup environment
pnpm env:setup

# Start development server
pnpm dev

# Run tests
pnpm test:e2e
pnpm test:auth

# Build for production
pnpm build

# Database operations
npx prisma generate
npx prisma migrate dev
npx prisma studio
```

## 🔧 Key Technologies

### NestJS Framework

- **Controllers**: Handle HTTP requests
- **Services**: Business logic
- **Modules**: Feature organization
- **Guards**: Authentication & authorization
- **Interceptors**: Request/response transformation
- **Filters**: Exception handling

### Prisma ORM

- **Schema-first approach**
- **Type-safe database queries**
- **Migration management**
- **Database seeding**

### Authentication

- **JWT tokens** for stateless auth
- **Passport.js** for strategy management
- **Argon2** for password hashing
- **Guards** for route protection

## 📝 Development Practices

### 1. Module Organization

```typescript
// Feature module structure
@Module({
  imports: [PrismaModule],
  controllers: [FeatureController],
  providers: [FeatureService],
  exports: [FeatureService],
})
export class FeatureModule {}
```

### 2. DTOs for Validation

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

### 3. Service Pattern

```typescript
@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async createUser(data: CreateUserDto): Promise<User> {
    // Business logic here
    return this.prisma.user.create({ data });
  }
}
```

### 4. Error Handling

```typescript
// Custom exceptions
throw new ApiError('User not found', 404);

// Global exception filter handles formatting
```

## 🧪 Testing Strategy

### Unit Tests

- Test individual services and utilities
- Mock external dependencies
- Focus on business logic

### Integration Tests

- Test API endpoints
- Use test database
- Verify database operations

### E2E Tests

- Test complete user workflows
- Use real HTTP requests
- Test authentication flows

### Running Tests

```bash
# All tests
pnpm test

# E2E tests only
pnpm test:e2e:backend

# Auth tests only
pnpm test:auth

# With coverage
pnpm test --coverage
```

## 🔐 Authentication Flow

1. **User Registration**

   ```typescript
   POST /auth/signup
   {
     "email": "user@example.com",
     "password": "securepassword"
   }
   ```

2. **User Login**

   ```typescript
   POST /auth/login
   {
     "email": "user@example.com",
     "password": "securepassword"
   }
   ```

3. **Protected Routes**
   ```typescript
   @UseGuards(JwtAuthGuard)
   @Get('profile')
   getProfile(@Request() req) {
     return req.user;
   }
   ```

## 📊 Database Management

### Schema Changes

```bash
# Create migration
npx prisma migrate dev --name add_user_table

# Apply migrations
npx prisma migrate deploy

# Reset database (development)
npx prisma migrate reset
```

### Database Seeding

```typescript
// prisma/seed.ts
async function main() {
  // Seed data here
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

## 🔍 Debugging

### Logging

```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async createUser(data: CreateUserDto) {
    this.logger.log(`Creating user: ${data.email}`);
    // ...
  }
}
```

### Environment Variables

```typescript
// config/env.ts
export const env = {
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  PORT: parseInt(process.env.PORT, 10) || 3000,
};
```

## 🚀 Performance Optimization

### Database Queries

- Use Prisma's `select` to limit fields
- Implement pagination for large datasets
- Use database indexes appropriately

### Caching

- Implement Redis for session storage
- Cache frequently accessed data
- Use HTTP caching headers

### Monitoring

- Add performance metrics
- Monitor database query performance
- Track API response times

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [Class Validator](https://github.com/typestack/class-validator)
