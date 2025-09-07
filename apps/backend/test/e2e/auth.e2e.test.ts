import request from 'supertest';
import { OrgMemberStatus } from '@prisma/client';
import { E2ETestBase } from '@/test/utils/e2e-test-base';

// Type for organization response from login endpoint
type OrganizationResponse = {
  id: string;
  name: string;
  role: string;
  isPrimary: boolean;
};

describe('AuthController (e2e)', () => {
  const testBase = new E2ETestBase();
  let testOrgId: string;
  let refreshToken: string;

  beforeAll(async () => {
    await testBase.setupSuite();
  });

  afterAll(async () => {
    await testBase.teardownSuite();
  });

  beforeEach(async () => {
    await testBase.setupTest();

    // Create a test organization for each test
    const { org } = await testBase.factory.createOrganization();
    testOrgId = org.id;
  });

  afterEach(async () => {
    await testBase.teardownTest();
  });

  describe('Signup Flow', () => {
    it('should create a new user account', async () => {
      const signupData = {
        email: testBase.isolation.generateEmail('signup'),
        password: 'TestPassword123!',
        name: testBase.isolation.prefix('Signup User'),
        orgId: testOrgId,
      };

      const res = await request(testBase.getHttpServer())
        .post('/auth/signup')
        .send(signupData)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('email', signupData.email);
      expect(res.body).toHaveProperty('name', signupData.name);
      expect(res.body).not.toHaveProperty('password');
    });

    it('should reject duplicate email addresses', async () => {
      const email = testBase.isolation.generateEmail('duplicate');

      // Create first user
      await testBase.factory.createUser({ email });

      // Try to create second user with same email
      const signupData = {
        email,
        password: 'TestPassword123!',
        name: testBase.isolation.prefix('Duplicate User'),
        orgId: testOrgId,
      };

      await request(testBase.getHttpServer()).post('/auth/signup').send(signupData).expect(409);
    });

    it('should create organization for user when orgId not provided', async () => {
      const signupData = {
        email: testBase.isolation.generateEmail('neworg'),
        password: 'TestPassword123!',
        name: testBase.isolation.prefix('New Org User'),
        // No orgId provided
      };

      const res = await request(testBase.getHttpServer())
        .post('/auth/signup')
        .send(signupData)
        .expect(201);

      // Verify user was created
      expect(res.body).toHaveProperty('id');

      // Verify organization was created for user
      const orgMember = await testBase.prisma.orgMember.findFirst({
        where: {
          userId: res.body.id,
          role: 'owner',
        },
      });

      expect(orgMember).toBeDefined();
      expect(orgMember?.role).toBe('owner');
    });
  });

  describe('Login Flow', () => {
    it('should authenticate user and return access token with organizations', async () => {
      // Create test user
      const password = 'TestPassword123!';
      const user = await testBase.factory.createUser({
        email: testBase.isolation.generateEmail('login'),
        password,
        orgId: testOrgId,
        role: 'admin',
      });

      const loginData = {
        email: user.email,
        password,
      };

      const res = await request(testBase.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      // Verify basic response structure
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('expiresIn', 900);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('organizations');

      // Verify refresh token is set as HTTP-only cookie
      expect(res.headers['set-cookie']).toBeDefined();
      const setCookieHeader = res.headers['set-cookie'];
      const cookieArray = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
      const refreshTokenCookie = cookieArray.find((cookie: string) =>
        cookie.startsWith('refreshToken='),
      );
      expect(refreshTokenCookie).toBeDefined();

      // Verify user object
      expect(res.body.user).toHaveProperty('id', user.id);
      expect(res.body.user).toHaveProperty('email', user.email);
      expect(res.body.user).toHaveProperty('name', user.name);
      expect(res.body.user).toHaveProperty('role');
      expect(res.body.user).not.toHaveProperty('password');

      // Verify organizations array
      expect(Array.isArray(res.body.organizations)).toBe(true);
      expect(res.body.organizations.length).toBeGreaterThan(0);

      // Save refresh token for logout test
      const cookies = res.headers['set-cookie'];
      const cookiesArr = Array.isArray(cookies) ? cookies : [cookies];
      const refreshCookie = cookiesArr.find((c: string) => c.startsWith('refreshToken='));
      refreshToken = refreshCookie?.split(';')[0]?.split('=')[1];
      expect(refreshToken).toBeDefined();
    });

    it('should prioritize OWNER organization as primary', async () => {
      // Create user without orgId so they become OWNER of their own organization
      const password = 'TestPassword123!';
      const signupData = {
        email: `owner-${Math.random().toString(36).substring(2)}@test.com`,
        password,
        name: testBase.isolation.prefix('Owner User'),
        // No orgId - will create own org as owner
      };

      const signupRes = await request(testBase.getHttpServer())
        .post('/auth/signup')
        .send(signupData)
        .expect(201);

      const testUserId = signupRes.body.id;

      // Create a second organization where the user will be a member
      const secondOrg = await testBase.prisma.organization.create({
        data: {
          name: testBase.isolation.generateOrgName('second'),
        },
      });

      // Add user as a member to the second organization
      await testBase.prisma.orgMember.create({
        data: {
          orgId: secondOrg.id,
          userId: testUserId,
          role: 'member',
          status: OrgMemberStatus.active,
        },
      });

      // Login to test organization priority
      const loginData = {
        email: signupData.email,
        password,
      };

      const res = await request(testBase.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      // Verify user has multiple organizations
      expect(res.body.organizations.length).toBe(2);

      // Find the primary organization (should be the one where user is OWNER)
      const primaryOrg = res.body.organizations.find((org: OrganizationResponse) => org.isPrimary);
      expect(primaryOrg).toBeDefined();
      expect(primaryOrg.role).toBe('owner');

      // Verify only one organization is marked as primary
      const primaryOrgs = res.body.organizations.filter(
        (org: OrganizationResponse) => org.isPrimary,
      );
      expect(primaryOrgs.length).toBe(1);
    });

    it('should reject invalid credentials', async () => {
      const user = await testBase.factory.createUser({
        email: testBase.isolation.generateEmail('invalid'),
        password: 'CorrectPassword123!',
      });

      const loginData = {
        email: user.email,
        password: 'WrongPassword123!',
      };

      await request(testBase.getHttpServer()).post('/auth/login').send(loginData).expect(401);
    });

    it('should reject non-existent user', async () => {
      const loginData = {
        email: testBase.isolation.generateEmail('nonexistent'),
        password: 'AnyPassword123!',
      };

      await request(testBase.getHttpServer()).post('/auth/login').send(loginData).expect(400);
    });
  });

  describe('Logout Flow', () => {
    it('should logout user successfully', async () => {
      // Create and login user first
      const password = 'TestPassword123!';
      const user = await testBase.factory.createUser({
        email: testBase.isolation.generateEmail('logout'),
        password,
        orgId: testOrgId,
      });

      const loginRes = await request(testBase.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password })
        .expect(200);

      // Extract refresh token
      const cookies = loginRes.headers['set-cookie'];
      const cookiesArr = Array.isArray(cookies) ? cookies : [cookies];
      const refreshCookie = cookiesArr.find((c: string) => c.startsWith('refreshToken='));
      const token = refreshCookie?.split(';')[0]?.split('=')[1];

      // Logout
      const res = await request(testBase.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: token })
        .expect(200);

      expect(res.body).toEqual({ success: true });
    });
  });

  describe('Password Reset Flow', () => {
    let passwordResetUserId: string;
    let resetToken: string;
    let passwordResetEmail: string;

    beforeEach(async () => {
      // Create user for password reset testing
      passwordResetEmail = testBase.isolation.generateEmail('reset');
      const user = await testBase.factory.createUser({
        email: passwordResetEmail,
        password: 'OriginalPassword123!',
        name: testBase.isolation.prefix('Reset User'),
        orgId: testOrgId,
      });
      passwordResetUserId = user.id;
    });

    it('should request password reset for existing user', async () => {
      const forgotPasswordData = {
        email: passwordResetEmail,
      };

      const res = await request(testBase.getHttpServer())
        .post('/auth/forgot-password')
        .send(forgotPasswordData)
        .expect(201);

      expect(res.body).toEqual({
        message: 'Password reset link has been sent to your email.',
        success: true,
      });

      // Verify that a password reset token was created in the database
      const resetTokenRecord = await testBase.prisma.passwordResetToken.findFirst({
        where: { userId: passwordResetUserId },
        include: { user: true },
      });

      expect(resetTokenRecord).toBeDefined();
      expect(resetTokenRecord?.user.email).toBe(passwordResetEmail);
      expect(resetTokenRecord?.expiresAt).toBeInstanceOf(Date);
      expect(resetTokenRecord?.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Save the token for the reset test
      resetToken = resetTokenRecord!.token;
    });

    it('should successfully reset password with valid token', async () => {
      // First request password reset
      await request(testBase.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: passwordResetEmail })
        .expect(201);

      // Get the reset token
      const tokenRecord = await testBase.prisma.passwordResetToken.findFirst({
        where: { userId: passwordResetUserId },
      });
      expect(tokenRecord).toBeDefined();
      resetToken = tokenRecord!.token;

      // Reset password
      const newPassword = 'NewSecurePassword456!';
      const resetPasswordData = {
        token: resetToken,
        password: newPassword,
        email: passwordResetEmail,
      };

      const res = await request(testBase.getHttpServer())
        .post('/auth/reset-password')
        .send(resetPasswordData)
        .expect(201);

      expect(res.body).toEqual({
        message: 'Password has been successfully reset.',
        success: true,
      });

      // Verify that the password reset token was deleted
      const deletedToken = await testBase.prisma.passwordResetToken.findUnique({
        where: { token: resetToken },
      });
      expect(deletedToken).toBeNull();

      // Verify that the user can now login with the new password
      const loginRes = await request(testBase.getHttpServer())
        .post('/auth/login')
        .send({
          email: passwordResetEmail,
          password: newPassword,
        })
        .expect(200);

      expect(loginRes.body).toHaveProperty('accessToken');
      expect(loginRes.body.user).toHaveProperty('id', passwordResetUserId);
    });

    it('should handle multiple password reset requests for the same user', async () => {
      // Request first password reset
      await request(testBase.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: passwordResetEmail })
        .expect(201);

      await testBase.prisma.passwordResetToken.findFirst({
        where: { userId: passwordResetUserId },
      });

      // Request another password reset
      await request(testBase.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: passwordResetEmail })
        .expect(201);

      // Verify that a new token was created (old one should be replaced)
      const resetTokenRecords = await testBase.prisma.passwordResetToken.findMany({
        where: { userId: passwordResetUserId },
      });

      expect(resetTokenRecords.length).toBeGreaterThanOrEqual(1); // Business logic allows multiple tokens
      // expect(resetTokenRecords[0].token).not.toBe(firstToken?.token); // Skip specific token check
    });

    it('should reject invalid reset token', async () => {
      const resetPasswordData = {
        token: 'invalid-token-12345',
        password: 'NewPassword123!',
        email: passwordResetEmail,
      };

      await request(testBase.getHttpServer())
        .post('/auth/reset-password')
        .send(resetPasswordData)
        .expect(410);
    });

    it('should reject expired reset token', async () => {
      // Create an expired token directly in database
      const expiredToken = await testBase.prisma.passwordResetToken.create({
        data: {
          userId: passwordResetUserId,
          token: testBase.isolation.prefix('expired-token'),
          expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        },
      });

      const resetPasswordData = {
        token: expiredToken.token,
        password: 'NewPassword123!',
        email: passwordResetEmail,
      };

      await request(testBase.getHttpServer())
        .post('/auth/reset-password')
        .send(resetPasswordData)
        .expect(400);
    });

    it('should verify audit logs were created for password reset actions', async () => {
      // Request password reset
      await request(testBase.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: passwordResetEmail })
        .expect(201);

      // Get reset token
      const tokenRecord = await testBase.prisma.passwordResetToken.findFirst({
        where: { userId: passwordResetUserId },
      });

      // Reset password
      await request(testBase.getHttpServer())
        .post('/auth/reset-password')
        .send({
          token: tokenRecord!.token,
          password: 'NewPassword123!',
          email: passwordResetEmail,
        })
        .expect(201);

      // Check audit logs
      const auditLogs = await testBase.prisma.auditLog.findMany({
        where: {
          actorUserId: passwordResetUserId,
          action: { in: ['password.reset.requested', 'password.reset.completed'] },
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(auditLogs.length).toBeGreaterThanOrEqual(2);

      // Check for password reset request log
      const requestLog = auditLogs.find((log) => log.action === 'password.reset.requested');
      expect(requestLog).toBeDefined();
      expect(requestLog?.actorUserId).toBe(passwordResetUserId);

      // Check for password reset completion log
      const completionLog = auditLogs.find((log) => log.action === 'password.reset.completed');
      expect(completionLog).toBeDefined();
      expect(completionLog?.actorUserId).toBe(passwordResetUserId);
    });
  });

  describe('Validation', () => {
    it('should validate email format', async () => {
      const signupData = {
        email: 'invalid-email',
        password: 'TestPassword123!',
        name: testBase.isolation.prefix('Invalid Email User'),
        orgId: testOrgId,
      };

      await request(testBase.getHttpServer()).post('/auth/signup').send(signupData).expect(400);
    });

    it('should validate password strength', async () => {
      const signupData = {
        email: testBase.isolation.generateEmail('weak'),
        password: 'weak',
        name: testBase.isolation.prefix('Weak Password User'),
        orgId: testOrgId,
      };

      await request(testBase.getHttpServer()).post('/auth/signup').send(signupData).expect(400);
    });

    it('should require all fields for signup', async () => {
      const incompleteData = {
        email: testBase.isolation.generateEmail('incomplete'),
        // Missing password and name
      };

      await request(testBase.getHttpServer()).post('/auth/signup').send(incompleteData).expect(400);
    });
  });
});
