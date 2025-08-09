# API Reference

Complete reference for the AsyncStand REST API (Currently Implemented Endpoints).

## Base Information

- **Base URL**: `http://localhost:3001`
- **API Version**: v1
- **Content Type**: `application/json`
- **Authentication**: Bearer token (JWT)
- **API Documentation**: Available at `/api/docs` (Swagger UI)

## Authentication

All authentication endpoints are publicly accessible (no JWT required).

### POST /auth/signup

Register a new user account and create their organization.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "orgId": "optional-existing-org-id"
}
```

**Response (200):**

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "name": "John Doe"
}
```

**Validation Rules:**

- `email`: Valid email format, unique
- `password`: Minimum 8 characters
- `name`: Optional string
- `orgId`: Optional UUID for joining existing organization

### POST /auth/login

Authenticate user and return JWT tokens.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**

```json
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "organizations": [
    {
      "id": "org-uuid",
      "name": "My Organization",
      "role": "owner",
      "isPrimary": true
    }
  ]
}
```

**Notes:**

- Refresh token is set as httpOnly cookie
- Returns all organizations user belongs to

### POST /auth/logout

Logout user and invalidate refresh token.

**Request Body:**

```json
{
  "refreshToken": "optional-token-if-not-in-cookie"
}
```

**Response (200):**

```json
{
  "message": "Successfully logged out",
  "success": true
}
```

### POST /auth/forgot-password

Request password reset email.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response (200):**

```json
{
  "message": "Password reset link has been sent to your email.",
  "success": true
}
```

**Rate Limited:** 5 requests per hour per IP

### POST /auth/reset-password

Reset password using token from email.

**Request Body:**

```json
{
  "token": "reset-token-from-email",
  "password": "NewSecurePass123!",
  "email": "user@example.com"
}
```

**Response (200):**

```json
{
  "message": "Password has been successfully reset.",
  "success": true
}
```

## Organization Management

Requires JWT authentication. Organization context determined from JWT.

### GET /org

Get current organization details.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "id": "org-uuid",
  "name": "My Organization",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### PATCH /org

Update organization details.

**Required Role:** `owner`

**Request Body:**

```json
{
  "name": "Updated Organization Name"
}
```

**Response (200):**

```json
{
  "id": "org-uuid",
  "name": "Updated Organization Name",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Organization Members

Manage organization membership, invitations, and roles.

### GET /org/members

List all organization members.

**Required Role:** `owner`, `admin`, `member`

**Response (200):**

```json
{
  "members": [
    {
      "id": "member-uuid",
      "userId": "user-uuid",
      "role": "owner",
      "status": "active",
      "joinedAt": "2024-01-01T00:00:00.000Z",
      "user": {
        "id": "user-uuid",
        "email": "user@example.com",
        "name": "John Doe"
      }
    }
  ]
}
```

### POST /org/members/invite

Invite a new member to the organization.

**Required Role:** `owner`, `admin`

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "role": "member"
}
```

**Response (200):**

```json
{
  "message": "Invitation sent successfully",
  "inviteId": "invite-uuid"
}
```

**Validation:**

- `email`: Valid email format
- `role`: Must be `member` or `admin` (only owners can invite other owners)

### POST /org/members/accept

Accept an organization invitation.

**Request Body:**

```json
{
  "token": "invitation-token-from-email",
  "name": "John Doe",
  "password": "SecurePass123!"
}
```

**Response (200):**

```json
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "organizations": [
    {
      "id": "org-uuid",
      "name": "Organization Name",
      "role": "member",
      "isPrimary": true
    }
  ]
}
```

**Notes:**

- For new users: `name` and `password` required
- For existing users: only `token` required

### PATCH /org/members/:id

Update member role or status.

**Required Role:** `owner`, `admin` (with restrictions)

**Request Body:**

```json
{
  "role": "admin",
  "status": "suspended"
}
```

**Response (200):**

```json
{
  "success": true,
  "member": {
    "id": "member-uuid",
    "role": "admin",
    "status": "active",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Authorization Rules:**

- Owners can modify anyone except other owners
- Admins can only modify members
- Cannot modify yourself
- Cannot modify the last owner

### DELETE /org/members/:id

Remove member from organization.

**Required Role:** `owner`, `admin` (with restrictions)

**Response (200):**

```json
{
  "success": true,
  "message": "Member removed successfully"
}
```

**Authorization Rules:**

- Same as PATCH /org/members/:id
- Cannot delete the last owner/admin

## Team Management

Manage teams linked to Slack channels.

### POST /teams

Create a new team.

**Required Role:** `owner`, `admin`

**Request Body:**

```json
{
  "name": "Development Team",
  "integrationId": "slack-integration-uuid",
  "slackChannelId": "C1234567890",
  "timezone": "America/New_York"
}
```

**Response (200):**

```json
{
  "id": "team-uuid"
}
```

### GET /teams

List all teams in the organization.

**Required Role:** `owner`, `admin`, `member`

**Response (200):**

```json
{
  "teams": [
    {
      "id": "team-uuid",
      "name": "Development Team",
      "slackChannelId": "C1234567890",
      "timezone": "America/New_York",
      "memberCount": 5,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET /teams/:id

Get detailed team information.

**Required Role:** `owner`, `admin`, `member`

**Response (200):**

```json
{
  "id": "team-uuid",
  "name": "Development Team",
  "slackChannelId": "C1234567890",
  "timezone": "America/New_York",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "members": [
    {
      "id": "team-member-uuid",
      "user": {
        "id": "user-uuid",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "slackUserId": "U1234567890",
      "joinedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "integration": {
    "id": "integration-uuid",
    "name": "Slack Workspace",
    "status": "active"
  }
}
```

### PUT /teams/:id

Update team details.

**Required Role:** `owner`, `admin`

**Request Body:**

```json
{
  "name": "Updated Team Name",
  "timezone": "Europe/London"
}
```

**Response (200):**

```json
{
  "success": true
}
```

## Slack Integration

OAuth and integration management for Slack workspaces.

### GET /slack/oauth/start

Initialize Slack OAuth flow.

**Query Parameters:**

- `orgId`: Organization UUID

**Response:** Redirects to Slack authorization URL

### GET /slack/oauth/callback

Handle Slack OAuth callback.

**Query Parameters:**

- `code`: Authorization code from Slack
- `state`: State token for security

**Response:** Redirects to frontend with success/error status

## Error Responses

All endpoints return errors in the following format:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "issue": "Email already exists"
    }
  }
}
```

### HTTP Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (invalid/missing JWT)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `409`: Conflict (duplicate resource)
- `422`: Unprocessable Entity (business logic error)
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error

### Common Error Codes

- `VALIDATION_FAILED`: Input validation failed
- `AUTHENTICATION_FAILED`: Invalid credentials
- `AUTHORIZATION_FAILED`: Insufficient permissions
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist
- `DUPLICATE_RESOURCE`: Resource already exists
- `BUSINESS_RULE_VIOLATION`: Operation violates business rules

## Rate Limiting

- **Password Reset**: 5 requests per hour per IP
- **Login Attempts**: 10 requests per 15 minutes per IP
- **API Calls**: 1000 requests per hour per authenticated user

## Pagination

Currently, all list endpoints return complete results. Pagination will be added in future versions for endpoints returning large datasets.

## Notes

- All timestamps are in ISO 8601 format (UTC)
- UUIDs are used for all resource identifiers
- JWT tokens expire after 15 minutes (access tokens)
- Refresh tokens expire after 7 days
- Audit logs are automatically created for all data modification operations
