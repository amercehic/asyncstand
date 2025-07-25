# Contributing Guidelines

Thank you for your interest in contributing to AsyncStand! This document provides guidelines for contributing to the project.

## 🤝 How to Contribute

### 1. Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally
3. Add the upstream remote:
   ```bash
   git remote add upstream <original-repo-url>
   ```

### 2. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 3. Development Workflow

1. **Install dependencies**: `pnpm install`
2. **Setup environment**: `pnpm env:setup`
3. **Start development**: `pnpm dev`
4. **Run tests**: `pnpm test`
5. **Lint code**: `pnpm lint`

### 4. Make Your Changes

- Follow the [Code Style Guide](./code-style.md)
- Write tests for new features
- Update documentation as needed
- Keep commits atomic and well-described

### 5. Test Your Changes

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:auth
pnpm test:e2e:backend

# Check linting
pnpm lint

# Build the project
pnpm build
```

### 6. Commit Your Changes

```bash
git add .
git commit -m "feat: add user authentication endpoint

- Add POST /auth/login endpoint
- Implement JWT token generation
- Add comprehensive test coverage
- Update API documentation"
```

### 7. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:

- Clear description of changes
- Link to related issues
- Screenshots (if UI changes)
- Test results

## 📋 Pull Request Guidelines

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] Documentation is updated
- [ ] No console.log statements
- [ ] No sensitive data in commits

### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)

## Screenshots (if applicable)
```

## 🏷️ Issue Guidelines

### Bug Reports

- Use the bug report template
- Include steps to reproduce
- Provide expected vs actual behavior
- Include environment details

### Feature Requests

- Use the feature request template
- Explain the problem you're solving
- Describe the proposed solution
- Consider implementation complexity

## 🎯 Development Priorities

### High Priority

- Security vulnerabilities
- Critical bugs
- Performance issues
- Documentation gaps

### Medium Priority

- New features
- UI/UX improvements
- Code refactoring
- Test coverage improvements

### Low Priority

- Nice-to-have features
- Cosmetic changes
- Experimental features

## 🔧 Development Setup

### Prerequisites

- Node.js 18+
- pnpm 7+
- Git
- SQLite (development)

### Quick Setup

```bash
# Clone repository
git clone <your-fork-url>
cd asyncstand

# Install dependencies
pnpm install

# Setup environment
pnpm env:setup

# Start development
pnpm dev
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL="file:./dev.db"

# JWT
JWT_SECRET="your-secret-key"

# Server
PORT=3000
```

## 🧪 Testing Guidelines

### Writing Tests

- Write tests for all new features
- Aim for 80%+ code coverage
- Use descriptive test names
- Test both success and failure cases

### Test Structure

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a new user with valid data', async () => {
      // Arrange
      const userData = { email: 'test@example.com', password: 'password123' };

      // Act
      const result = await userService.createUser(userData);

      // Assert
      expect(result).toBeDefined();
      expect(result.email).toBe(userData.email);
    });

    it('should throw error for invalid email', async () => {
      // Test error cases
    });
  });
});
```

## 📚 Documentation Guidelines

### Code Documentation

- Use JSDoc for public APIs
- Include examples in comments
- Document complex algorithms
- Keep comments up-to-date

### README Updates

- Update relevant README files
- Add usage examples
- Document breaking changes
- Include migration guides

## 🚀 Release Process

### Versioning

We use [Semantic Versioning](https://semver.org/):

- **Major**: Breaking changes
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes (backward compatible)

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Version bumped
- [ ] Release notes written

## 🤝 Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Help others learn
- Provide constructive feedback
- Follow project conventions

### Communication

- Use GitHub issues for discussions
- Be clear and concise
- Ask questions when unsure
- Share knowledge and experiences

## 📞 Getting Help

- **Documentation**: Check the [docs](../README.md)
- **Issues**: Search existing issues first
- **Discussions**: Use GitHub Discussions
- **Chat**: Join our community chat (if available)

## 🙏 Recognition

Contributors will be recognized in:

- Project README
- Release notes
- Contributor hall of fame
- GitHub contributors page

Thank you for contributing to AsyncStand! 🚀
