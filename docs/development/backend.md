# Backend Development Guide

This guide covers developing the AsyncStand backend API, built with NestJS, Prisma, and PostgreSQL.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Core Concepts](#core-concepts)
- [Database Management](#database-management)
- [Authentication & Authorization](#authentication--authorization)
- [API Development](#api-development)
- [Testing](#testing)
- [Integrations](#integrations)
- [Best Practices](#best-practices)

## Architecture Overview

The AsyncStand backend follows NestJS architectural patterns with a modular, domain-driven design:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Controllers   │    │    Services     │    │   Repositories  │
│   (HTTP Layer)  │───►│ (Business Logic)│───►│  (Data Access)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│      DTOs       │    │     Guards      │    │     Database    │
│  (Validation)   │    │ (Authorization) │    │  (PostgreSQL)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Current Implementation Status

- ✅ **Authentication System** - Complete JWT-based auth with refresh tokens
- ✅ **Organization Management** - Multi-tenant organization structure
- ✅ **Member Management** - Invitations, roles, RBAC
- ✅ **Team Management** - Slack channel-linked teams
- ✅ **Slack Integration** - OAuth flow and basic API integration
- ✅ **Audit Logging** - Comprehensive activity tracking
- 🚧 **Standup Features** - Database schema exists, API endpoints planned
- 🚧 **Background Jobs** - Infrastructure planned, not implemented

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL 14+
- Redis 6+

### Installation

```bash
# Navigate to project and install
cd asyncstand
pnpm install

# Setup backend environment
cd apps/backend
cp .env.example .env
# Edit .env with your configuration

# Database setup
pnpm db:migrate
pnpm db:generate
```

### Development Commands

```bash
# Development server with hot reload
pnpm dev

# Production build
pnpm build

# Production server
pnpm start:prod

# Database commands
pnpm db:migrate        # Run migrations
pnpm db:studio         # Open Prisma Studio
pnpm db:generate       # Generate Prisma client
pnpm db:reset          # Reset database (dev only)

# Testing
pnpm test              # All tests
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests
pnpm test:e2e         # End-to-end tests
pnpm test:coverage     # Coverage report

# Code quality
pnpm lint              # ESLint
pnpm lint:fix          # Fix linting issues
pnpm format            # Prettier formatting
pnpm typecheck         # TypeScript checks
```

## Project Structure

```
apps/backend/src/
├── auth/                      # Authentication & authorization module
│   ├── controllers/           # HTTP endpoints
│   │   ├── auth.controller.ts         # Signup, login, logout, password reset
│   │   ├── org-members.controller.ts  # Member management
│   │   └── organization.controller.ts # Organization management
│   ├── services/              # Business logic
│   │   ├── auth.service.ts           # Authentication logic
│   │   ├── org-members.service.ts    # Member operations
│   │   ├── organization.service.ts   # Organization operations
│   │   ├── password-reset.service.ts # Password reset logic
│   │   ├── token.service.ts          # JWT token management
│   │   └── user.service.ts           # User management
│   ├── guards/                # Authorization guards
│   │   ├── jwt-auth.guard.ts         # JWT authentication
│   │   └── roles.guard.ts            # Role-based authorization
│   ├── decorators/            # Custom decorators
│   │   ├── current-org.decorator.ts  # Get current organization
│   │   └── current-user.decorator.ts # Get current user
│   ├── dto/                   # Data transfer objects
│   ├── jobs/                  # Scheduled jobs
│   │   └── cleanup-expired-invites.job.ts
│   └── validators/            # Custom validation rules
├── teams/                     # Team management module
│   ├── teams.controller.ts    # Team CRUD operations
│   ├── team-management.service.ts # Team business logic
│   ├── dto/                   # Team-related DTOs
│   └── types/                 # TypeScript types
├── integrations/              # External platform integrations
│   └── slack/                 # Slack integration
│       ├── slack-oauth.controller.ts      # OAuth flow
│       ├── slack-integration.controller.ts # Slack API
│       ├── slack-oauth.service.ts         # OAuth logic
│       ├── slack-api.service.ts           # Slack API client
│       └── dto/               # Slack DTOs
├── common/                    # Shared utilities
│   ├── audit/                 # Audit logging system
│   │   ├── audit-log.service.ts
│   │   ├── audit.interceptor.ts
│   │   └── decorators.ts
│   ├── logger.service.ts      # Structured logging
│   ├── redis.service.ts       # Redis client
│   └── http-exception.filter.ts
├── config/                    # Configuration
│   ├── env.ts                 # Environment validation
│   └── logger.config.ts       # Logger setup
├── prisma/                    # Database
│   └── prisma.module.ts       # Prisma service
├── swagger/                   # API documentation
└── main.ts                    # Application entry point
```

## Core Concepts

### Controllers

Handle HTTP requests and responses:

```typescript
@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Register a new user' })
  async signup(@Body() signupDto: SignupDto): Promise<AuthResponse> {
    return this.authService.signup(signupDto.email, signupDto.password, signupDto.name);
  }
}
```

### Services

Contain business logic:

```typescript
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async signup(email: string, password: string, name?: string): Promise<User> {
    // Business logic implementation
    const hashedPassword = await hash(password, 12);
    return this.prisma.user.create({
      data: { email, passwordHash: hashedPassword, name },
    });
  }
}
```

### DTOs (Data Transfer Objects)

Define request/response schemas with validation:

```typescript
export class SignupDto {
  @IsEmail()
  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @IsString()
  @MinLength(8)
  @ApiProperty({ example: 'SecurePass123!' })
  password: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'John Doe', required: false })
  name?: string;
}
```

## Database Management

### Prisma Workflow

The backend uses Prisma ORM for type-safe database access:

```bash
# 1. Modify schema
edit prisma/schema.prisma

# 2. Generate migration
pnpm db:migrate

# 3. Generate client types
pnpm db:generate

# 4. Use in code
const user = await prisma.user.findUnique({ where: { email } });
```

### Common Patterns

#### Service with Prisma

```typescript
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        orgMembers: {
          include: {
            org: true,
          },
        },
      },
    });
  }

  async createUser(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...data,
        passwordHash: await hash(data.password, 12),
      },
    });
  }
}
```

### Multi-Tenant Patterns

AsyncStand uses organization-based multi-tenancy:

```typescript
// Always scope queries by organization
async getTeams(orgId: string): Promise<Team[]> {
  return this.prisma.team.findMany({
    where: { orgId },
    include: {
      members: {
        include: { user: true }
      }
    }
  });
}

// Use transaction for cross-table operations
async createTeamWithMembers(orgId: string, teamData: CreateTeamData): Promise<Team> {
  return this.prisma.$transaction(async (tx) => {
    const team = await tx.team.create({
      data: { ...teamData, orgId }
    });

    await tx.teamMember.createMany({
      data: teamData.memberIds.map(userId => ({
        teamId: team.id,
        userId,
        addedByUserId: teamData.createdByUserId
      }))
    });

    return team;
  });
}
```

## Authentication & Authorization

### JWT Authentication

The backend uses JWT tokens with refresh token rotation:

```typescript
// Generate tokens
const payload = { sub: user.id, email: user.email, orgId };
const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

// Validate tokens with guards
@UseGuards(JwtAuthGuard)
@Get('profile')
async getProfile(@CurrentUser() user: AuthenticatedUser) {
  return user;
}
```

### Role-Based Authorization

Use guards and decorators for authorization:

```typescript
// Role guard
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some(role => user.role === role);
  }
}

// Usage in controllers
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(OrgRole.admin, OrgRole.owner)
@Post('teams')
async createTeam(@Body() createTeamDto: CreateTeamDto) {
  // Only admins and owners can create teams
}
```

### Custom Decorators

Extract user context easily:

```typescript
// Get current user
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

// Get current organization
export const CurrentOrg = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.orgId;
  },
);

// Usage
@Get('teams')
async getTeams(
  @CurrentOrg() orgId: string,
  @CurrentUser('userId') userId: string
) {
  return this.teamService.findByOrg(orgId);
}
```

## API Development

### RESTful Design

Follow REST conventions:

```typescript
@Controller('teams')
export class TeamsController {
  @Get()           // GET /teams - List teams
  @Post()          // POST /teams - Create team
  @Get(':id')      // GET /teams/:id - Get team
  @Put(':id')      // PUT /teams/:id - Update team
  @Delete(':id')   // DELETE /teams/:id - Delete team
}
```

### Request Validation

Use DTOs with class-validator:

```typescript
export class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  name: string;

  @IsUUID()
  @ApiProperty()
  integrationId: string;

  @IsString()
  @Matches(/^C[A-Z0-9]{8,}$/) // Slack channel ID format
  @ApiProperty()
  slackChannelId: string;

  @IsTimeZone()
  @ApiProperty()
  timezone: string;
}
```

### Response Formatting

Return consistent response structures:

```typescript
// Success response
@Post('teams')
async createTeam(@Body() dto: CreateTeamDto): Promise<{ id: string }> {
  const team = await this.teamService.create(dto);
  return { id: team.id };
}

// List response
@Get('teams')
async listTeams(@CurrentOrg() orgId: string): Promise<TeamListResponse> {
  const teams = await this.teamService.findByOrg(orgId);
  return { teams };
}
```

### Error Handling

Use structured error responses:

```typescript
// Custom exception
export class BusinessRuleException extends HttpException {
  constructor(message: string, code: ErrorCode) {
    super(
      {
        error: {
          code,
          message,
          timestamp: new Date().toISOString(),
        },
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

// Usage
if (team.members.length === 0) {
  throw new BusinessRuleException(
    'Cannot delete team with members',
    ErrorCode.BUSINESS_RULE_VIOLATION,
  );
}
```

## Testing

### Test Structure

```
test/
├── unit/                      # Isolated unit tests
│   ├── auth/
│   │   ├── controllers/
│   │   └── services/
│   └── common/
├── integration/               # Service integration tests
│   └── auth/
│       └── auth-flow.integration.test.ts
├── e2e/                      # End-to-end API tests
│   ├── auth.e2e.test.ts
│   └── org-members.e2e.test.ts
└── utils/                    # Test utilities
    ├── factories/
    ├── mocks/
    └── test-helpers.ts
```

### Unit Testing

Test individual components in isolation:

```typescript
describe('AuthService', () => {
  let service: AuthService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AuthService, { provide: PrismaService, useValue: mockDeep<PrismaService>() }],
    }).compile();

    service = module.get(AuthService);
    prisma = module.get(PrismaService);
  });

  it('should create user with hashed password', async () => {
    const userData = { email: 'test@example.com', password: 'password' };
    prisma.user.create.mockResolvedValue({ id: '1', ...userData } as User);

    const result = await service.signup(userData.email, userData.password);

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: userData.email,
        passwordHash: expect.not.stringMatching(userData.password),
      }),
    });
  });
});
```

### Integration Testing

Test service interactions with database:

```typescript
describe('Auth Flow Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    prisma = module.get(PrismaService);
    await app.init();
  });

  it('should complete signup and login flow', async () => {
    // Create user
    const signupData = { email: 'test@example.com', password: 'password' };
    await request(app.getHttpServer()).post('/auth/signup').send(signupData).expect(200);

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { email: signupData.email } });
    expect(user).toBeDefined();

    // Login
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(signupData)
      .expect(200);

    expect(loginResponse.body).toHaveProperty('accessToken');
  });
});
```

### E2E Testing

Test complete API workflows:

```typescript
describe('Organization Members E2E', () => {
  let app: INestApplication;
  let ownerToken: string;

  beforeEach(async () => {
    // Setup test app and authenticate as owner
    app = await createTestApp();
    ownerToken = await authenticateAsOwner(app);
  });

  it('should invite and accept member', async () => {
    // Send invitation
    const inviteResponse = await request(app.getHttpServer())
      .post('/org/members/invite')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'newuser@example.com', role: 'member' })
      .expect(200);

    // Accept invitation
    const acceptResponse = await request(app.getHttpServer())
      .post('/org/members/accept')
      .send({
        token: inviteResponse.body.inviteId,
        name: 'New User',
        password: 'password',
      })
      .expect(200);

    expect(acceptResponse.body).toHaveProperty('accessToken');
    expect(acceptResponse.body.user.email).toBe('newuser@example.com');
  });
});
```

## Integrations

### Slack Integration

The Slack integration handles OAuth flow and API interactions:

```typescript
// OAuth flow
@Get('oauth/start')
async startOAuth(@Query('orgId') orgId: string, @Res() res: Response) {
  const state = await this.redisService.generateStateToken(orgId);
  const oauthUrl = this.buildSlackOAuthUrl(state);
  res.redirect(oauthUrl);
}

@Get('oauth/callback')
async handleCallback(@Query() query: SlackOauthCallbackDto) {
  const integration = await this.slackOauthService.handleCallback(
    query.code,
    query.state
  );
  // Redirect to frontend with success/error
}
```

## Best Practices

### Code Organization

1. **Module Structure**: Group related features in modules
2. **Service Separation**: Keep controllers thin, services focused
3. **DTO Validation**: Always validate inputs with DTOs
4. **Error Handling**: Use structured exceptions with proper HTTP codes

### Database Best Practices

1. **Transactions**: Use for multi-table operations
2. **Indexes**: Add indexes for frequently queried fields
3. **Relations**: Use Prisma's include/select for performance
4. **Migrations**: Keep migrations small and reversible

### Security Best Practices

1. **Input Validation**: Validate all inputs with DTOs
2. **Authorization**: Check permissions at controller level
3. **Audit Logging**: Log all significant actions
4. **Rate Limiting**: Implement rate limiting for public endpoints

### Testing Best Practices

1. **Test Pyramid**: More unit tests, fewer integration/E2E tests
2. **Test Data**: Use factories for consistent test data
3. **Isolation**: Each test should be independent
4. **Coverage**: Aim for high coverage of business logic

### Performance Considerations

1. **Database Queries**: Use select/include to fetch only needed data
2. **Caching**: Cache frequently accessed data in Redis
3. **Pagination**: Implement pagination for large datasets
4. **Background Jobs**: Use queues for heavy operations

## Current Implementation Notes

- **Authentication**: Complete JWT-based system with refresh tokens
- **Organization Management**: Full CRUD operations with RBAC
- **Team Management**: Basic CRUD, linked to Slack channels
- **Slack Integration**: OAuth flow complete, API integration basic
- **Audit Logging**: Comprehensive tracking of all actions
- **Testing**: Unit, integration, and E2E tests implemented

## Planned Features

- **Background Jobs**: Email processing, scheduled tasks
- **Standup Management**: API endpoints for standup configuration and execution
- **Advanced Slack Features**: Slash commands, interactive messages
- **Webhook System**: External webhook support
- **Advanced Analytics**: Team performance insights
