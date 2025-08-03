# Contributing Guidelines

Thank you for your interest in contributing to AsyncStand! This guide will help you get started with contributing to our project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Security Guidelines](#security-guidelines)

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](./code-of-conduct.md). Please read it before contributing.

### Our Standards

- **Be respectful**: Treat everyone with respect and professionalism
- **Be inclusive**: Welcome newcomers and help them get started
- **Be constructive**: Provide helpful feedback and suggestions
- **Be patient**: Remember that everyone has different experience levels

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js 20+ installed
- pnpm 10+ installed
- PostgreSQL 14+ running
- Redis 6+ running
- Git configured with your name and email

### Development Setup

1. **Fork the repository** on GitHub

2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/asyncstand.git
   cd asyncstand
   ```

3. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/original-owner/asyncstand.git
   ```

4. **Install dependencies:**
   ```bash
   pnpm install
   ```

5. **Set up environment:**
   ```bash
   pnpm env:setup
   # Edit .env files with your configuration
   ```

6. **Run database migrations:**
   ```bash
   cd apps/backend
   pnpm db:migrate
   ```

7. **Start development servers:**
   ```bash
   pnpm dev
   ```

8. **Run tests to verify setup:**
   ```bash
   pnpm test
   ```

## Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:

- `feat/`: New features (`feat/slack-integration`)
- `fix/`: Bug fixes (`fix/auth-token-expiry`)
- `docs/`: Documentation updates (`docs/api-reference`)
- `refactor/`: Code refactoring (`refactor/user-service`)
- `test/`: Test improvements (`test/auth-coverage`)
- `chore/`: Maintenance tasks (`chore/update-dependencies`)

### Making Changes

1. **Create a new branch:**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** following our [code standards](#code-standards)

3. **Add tests** for your changes (see [testing requirements](#testing-requirements))

4. **Run the test suite:**
   ```bash
   pnpm test
   ```

5. **Run linting and formatting:**
   ```bash
   pnpm lint
   pnpm format
   ```

6. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: add slack integration support"
   ```

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes

#### Examples

```bash
feat: add slack OAuth integration
fix: resolve JWT token expiration issue
docs: update API documentation for teams endpoint
refactor: simplify user authentication logic
test: add integration tests for auth service
```

## Code Standards

### TypeScript Guidelines

1. **Strict Type Safety:**
   ```typescript
   // Good
   interface User {
     id: string;
     email: string;
     name?: string;
   }

   // Avoid
   const user: any = { id: '123', email: 'test@example.com' };
   ```

2. **Use Interfaces for Object Shapes:**
   ```typescript
   // Good
   interface CreateUserRequest {
     email: string;
     password: string;
     name?: string;
   }

   // Avoid
   type CreateUserRequest = {
     email: string;
     password: string;
     name?: string;
   };
   ```

3. **Prefer Union Types:**
   ```typescript
   // Good
   type UserRole = 'owner' | 'admin' | 'member';

   // Avoid
   enum UserRole {
     OWNER = 'owner',
     ADMIN = 'admin',
     MEMBER = 'member',
   }
   ```

### NestJS Best Practices

1. **Service Injection:**
   ```typescript
   // Good
   @Injectable()
   export class UserService {
     constructor(
       private readonly prisma: PrismaService,
       private readonly logger: LoggerService,
     ) {}
   }
   ```

2. **DTOs for Validation:**
   ```typescript
   // Good
   export class CreateUserDto {
     @IsEmail()
     @ApiProperty()
     email: string;

     @IsString()
     @MinLength(8)
     @ApiProperty()
     password: string;
   }
   ```

3. **Error Handling:**
   ```typescript
   // Good
   if (!user) {
     throw new NotFoundException(`User with ID ${id} not found`);
   }

   // Avoid
   if (!user) {
     throw new Error('User not found');
   }
   ```

### Database Guidelines

1. **Use Prisma Transactions for Related Operations:**
   ```typescript
   // Good
   return this.prisma.$transaction(async (tx) => {
     const user = await tx.user.create({ data: userData });
     await tx.orgMember.create({
       data: { userId: user.id, orgId, role: 'member' }
     });
     return user;
   });
   ```

2. **Include Only Needed Fields:**
   ```typescript
   // Good
   return this.prisma.user.findMany({
     select: {
       id: true,
       email: true,
       name: true,
     }
   });

   // Avoid
   return this.prisma.user.findMany(); // Returns all fields
   ```

### React Guidelines

1. **Functional Components with Hooks:**
   ```typescript
   // Good
   export const UserProfile: React.FC<{ userId: string }> = ({ userId }) => {
     const [user, setUser] = useState<User | null>(null);

     useEffect(() => {
       fetchUser(userId).then(setUser);
     }, [userId]);

     return <div>{user?.name}</div>;
   };
   ```

2. **Custom Hooks for Logic:**
   ```typescript
   // Good
   export const useUser = (userId: string) => {
     const [user, setUser] = useState<User | null>(null);
     const [loading, setLoading] = useState(true);

     useEffect(() => {
       fetchUser(userId)
         .then(setUser)
         .finally(() => setLoading(false));
     }, [userId]);

     return { user, loading };
   };
   ```

### File Structure Guidelines

```
feature-name/
├── controllers/        # HTTP controllers
├── services/          # Business logic
├── dto/               # Data transfer objects
├── entities/          # Database entities (if using TypeORM)
├── guards/            # Authentication/authorization
├── decorators/        # Custom decorators
├── types/             # TypeScript types/interfaces
├── tests/             # Feature-specific tests
└── feature-name.module.ts
```

## Testing Requirements

### Test Coverage

- **Minimum coverage**: 80% for new code
- **Required tests**: All public methods must have tests
- **Integration tests**: Critical user flows must have integration tests

### Test Types

1. **Unit Tests**: Test individual functions/methods in isolation
2. **Integration Tests**: Test service interactions with database
3. **E2E Tests**: Test complete API workflows

### Testing Guidelines

1. **Use Descriptive Test Names:**
   ```typescript
   // Good
   describe('AuthService', () => {
     describe('signup', () => {
       it('should create user and return tokens when valid data provided', () => {
         // test implementation
       });

       it('should throw ValidationError when email already exists', () => {
         // test implementation
       });
     });
   });
   ```

2. **Use Test Factories:**
   ```typescript
   // Good
   const createUserDto = createMockSignupDto({
     email: 'test@example.com',
     password: 'ValidPass123!',
   });

   // Avoid inline test data
   const userDto = {
     email: 'test@example.com',
     password: 'ValidPass123!',
     name: 'Test User',
   };
   ```

3. **Clean Up After Tests:**
   ```typescript
   describe('User Integration Tests', () => {
     beforeEach(async () => {
       await cleanupDatabase(prisma);
     });

     afterAll(async () => {
       await app.close();
     });
   });
   ```

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test type
pnpm test:unit
pnpm test:integration
pnpm test:e2e

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Pull Request Process

### Before Creating a PR

1. **Sync with upstream:**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   git push origin main
   ```

2. **Rebase your feature branch:**
   ```bash
   git checkout feat/your-feature
   git rebase main
   ```

3. **Run full test suite:**
   ```bash
   pnpm test
   pnpm lint
   pnpm typecheck
   ```

### Creating a Pull Request

1. **Push your branch:**
   ```bash
   git push origin feat/your-feature
   ```

2. **Create PR** using our template

3. **Fill out the PR template** completely

### PR Template

```markdown
## Description

Brief description of changes made.

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] All tests pass

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Code is commented where necessary
- [ ] Documentation updated
- [ ] No new warnings introduced
```

### PR Review Process

1. **Automated Checks**: All CI checks must pass
2. **Code Review**: At least one maintainer review required
3. **Testing**: All tests must pass
4. **Documentation**: Any necessary docs must be updated

### After PR Approval

1. **Squash and merge** (preferred method)
2. **Delete feature branch** after merge
3. **Update local main:**
   ```bash
   git checkout main
   git pull upstream main
   git push origin main
   ```

## Issue Guidelines

### Before Creating an Issue

1. **Search existing issues** to avoid duplicates
2. **Check documentation** for answers
3. **Verify the issue** on latest version

### Issue Types

#### Bug Reports

Use the bug report template and include:

- **Steps to reproduce**
- **Expected behavior**
- **Actual behavior**
- **Environment details**
- **Screenshots/logs** if applicable

#### Feature Requests

Use the feature request template and include:

- **Problem description**
- **Proposed solution**
- **Alternative solutions considered**
- **Use cases**

#### Questions

For questions:

- Check documentation first
- Use GitHub Discussions for general questions
- Use issues only for documentation gaps

### Issue Labels

- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Improvements or additions to docs
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention is needed
- `priority:high`: High priority items
- `status:needs-triage`: Needs initial review

## Security Guidelines

### Reporting Security Issues

**DO NOT** create public issues for security vulnerabilities.

Instead:

1. Email security issues to `security@asyncstand.com`
2. Include detailed description
3. Provide steps to reproduce
4. Allow reasonable time for response

### Security Best Practices

1. **Never commit secrets** to version control
2. **Use environment variables** for configuration
3. **Validate all inputs** in DTOs
4. **Use parameterized queries** (Prisma handles this)
5. **Follow principle of least privilege**

### Dependencies

- **Keep dependencies updated**: Use Dependabot
- **Audit dependencies**: Run `pnpm audit` regularly
- **Review new dependencies**: Ensure they're necessary and trusted

## Documentation

### When to Update Documentation

Update documentation when you:

- Add new features
- Change existing APIs
- Fix bugs that affect usage
- Update configuration options

### Documentation Types

1. **Code Comments**: Explain complex logic
2. **API Documentation**: Update Swagger annotations
3. **README Updates**: Keep installation/usage current
4. **Architecture Docs**: Update for structural changes

## Getting Help

### Communication Channels

- **GitHub Issues**: Bug reports, feature requests
- **GitHub Discussions**: General questions, ideas
- **Email**: security@asyncstand.com (security only)

### Maintainer Availability

- **Response time**: 2-3 business days for issues
- **Review time**: 3-5 business days for PRs
- **Release schedule**: Bi-weekly releases

## Recognition

Contributors are recognized in:

- **CONTRIBUTORS.md**: All contributors listed
- **Release notes**: Major contributors highlighted
- **Hall of Fame**: Outstanding contributors featured

---

Thank you for contributing to AsyncStand! Together we're building a better way for teams to stay connected asynchronously.
