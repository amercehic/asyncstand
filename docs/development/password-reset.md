# Password Reset Implementation

This document describes the implementation of the secure password reset functionality using magic links.

## Overview

The password reset system provides a secure, auditable flow for users who have forgotten their passwords. It uses single-use tokens with a 24-hour expiration and includes comprehensive audit logging.

## Architecture

### Components

1. **PasswordResetService** - Core service handling token generation, validation, and email sending
2. **AuthController** - REST endpoints for password reset requests
3. **DTOs** - Data transfer objects for request validation
4. **Email Templates** - MJML-based responsive email templates
5. **Rate Limiting** - Throttling to prevent abuse

### Database Schema

The system uses the existing `PasswordResetToken` model:

```prisma
model PasswordResetToken {
  token     String   @id @default(uuid())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  expiresAt DateTime

  @@index([token])
}
```

## API Endpoints

### POST /auth/forgot-password

Initiates a password reset request.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "message": "If an account with that email exists, a password reset link has been sent.",
  "success": true
}
```

**Rate Limiting:** 5 requests per hour per IP address

### POST /auth/reset-password

Completes the password reset process.

**Request Body:**

```json
{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "password": "newSecurePassword123",
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "message": "Password has been successfully reset.",
  "success": true
}
```

## Security Features

### Token Security

- **64-byte random tokens** (512 bits) using crypto.randomBytes()
- **24-hour expiration** for all tokens
- **Single-use tokens** - deleted after successful password reset
- **Email verification** - token must match the user's email

### Rate Limiting

- **5 requests per hour** per IP address for forgot-password endpoint
- Prevents brute force attacks and email spam

### Privacy Protection

- **No user enumeration** - same response for existing and non-existing emails
- **Secure error messages** - don't reveal sensitive information

### Audit Logging

- **password.reset.requested** - when reset is initiated
- **password.reset.completed** - when password is successfully changed
- Includes IP address, user ID, and timestamp

## Email System

### Development Environment

- Uses **Ethereal Email** for testing
- Emails are captured and can be previewed via provided URLs
- No actual emails sent to real addresses

### Production Environment

- Configurable SMTP settings
- Supports SendGrid, AWS SES, or any SMTP provider
- Responsive MJML email templates

### Email Template Features

- **Responsive design** - works on desktop and mobile
- **Dark/light mode compatible** - uses neutral colors
- **Clear call-to-action** - prominent reset button
- **Fallback link** - text link if button doesn't work
- **Security notice** - explains 24-hour expiration

## Environment Variables

```bash
# Frontend URL for reset links
FRONTEND_URL=http://localhost:3000

# Email configuration
FROM_EMAIL=noreply@asyncstand.com
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
```

## Testing

### Unit Tests

```bash
pnpm test:unit
```

Tests cover:

- Token generation and validation
- Email sending (mocked)
- Error handling
- Audit logging

### Integration Tests

```bash
pnpm test:password-reset
```

Tests cover:

- Complete password reset flow
- Rate limiting
- Error scenarios
- Database state verification

### Email Preview

```bash
pnpm preview:email
```

Generates HTML preview of email templates for development.

## Error Handling

### Token Errors

- **TOKEN_EXPIRED** (400) - Token has expired
- **TOKEN_ALREADY_USED** (410) - Token is invalid or already used
- **VALIDATION_FAILED** (400) - Email doesn't match token

### Rate Limiting

- **429 Too Many Requests** - Rate limit exceeded

### Validation Errors

- **400 Bad Request** - Invalid email format, missing fields, password too short

## Implementation Checklist

- [x] PasswordResetService implementation
- [x] MJML email templates
- [x] Rate limiting with @nestjs/throttler
- [x] Comprehensive unit tests (90%+ coverage)
- [x] Integration tests with in-memory database
- [x] Audit logging for security events
- [x] Environment configuration
- [x] Error handling and validation
- [x] Email preview script
- [x] Documentation

## Usage Example

### Frontend Integration

```typescript
// Request password reset
const response = await fetch('/auth/forgot-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' }),
});

// Handle reset (when user clicks email link)
const resetResponse = await fetch('/auth/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: 'token-from-url',
    password: 'newPassword123',
    email: 'user@example.com',
  }),
});
```

### URL Structure

Reset links follow this pattern:

```
http://localhost:3000/reset-password?token=<token>&email=<email>
```

## Security Considerations

1. **Token Entropy** - 64-byte random tokens provide 512 bits of entropy
2. **Expiration** - 24-hour limit prevents long-term token exposure
3. **Single Use** - Tokens are immediately deleted after use
4. **Rate Limiting** - Prevents abuse and email spam
5. **Audit Trail** - Complete logging of all reset attempts
6. **No Enumeration** - Same response regardless of email existence
7. **Email Verification** - Token must match the user's email address

## Future Enhancements

1. **Email Templates** - Add more branding and customization options
2. **SMS Fallback** - Add SMS-based reset for high-security accounts
3. **Account Lockout** - Implement account lockout after multiple failed attempts
4. **Token Rotation** - Rotate tokens on failed attempts
5. **Geolocation Tracking** - Log and alert on suspicious locations
