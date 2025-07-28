import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { OrgMemberStatus } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';

// Type for organization response from login endpoint
type OrganizationResponse = {
  id: string;
  name: string;
  role: string;
  isPrimary: boolean;
};

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgId: string;
  let userId: string;
  let refreshToken: string;

  const testUser = {
    email: 'test@example.com',
    password: 'TestPassword123!',
    name: 'Test User',
  };

  const passwordResetUser = {
    email: 'reset@example.com',
    password: 'OriginalPassword123!',
    name: 'Reset Test User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up any existing test data for this specific test user
    await prisma.orgMember.deleteMany({ where: { user: { email: testUser.email } } });
    await prisma.user.deleteMany({ where: { email: testUser.email } });
    await prisma.organization.deleteMany({ where: { name: 'Test Org' } });

    // Clean up password reset test data
    await prisma.passwordResetToken.deleteMany({
      where: { user: { email: passwordResetUser.email } },
    });
    await prisma.orgMember.deleteMany({ where: { user: { email: passwordResetUser.email } } });
    await prisma.user.deleteMany({ where: { email: passwordResetUser.email } });

    // Clean up any existing refresh tokens to avoid unique constraint violations
    await prisma.refreshToken.deleteMany({});

    // Create a test organization
    const org = await prisma.organization.create({
      data: { name: 'Test Org' },
    });
    orgId = org.id;
  });

  afterAll(async () => {
    // Clean up only the test data we created
    if (userId) {
      await prisma.orgMember.deleteMany({ where: { userId } });
    }
    await prisma.user.deleteMany({ where: { email: testUser.email } });
    await prisma.user.deleteMany({ where: { email: passwordResetUser.email } });
    if (orgId) {
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }

    // Close Prisma connection
    await prisma.$disconnect();

    // Close the app
    await app.close();
  });

  it('should create a new user account', async () => {
    const signupData = {
      ...testUser,
      orgId,
    };
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send(signupData)
      .expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('email', testUser.email);
    expect(res.body).toHaveProperty('name', testUser.name);
    expect(res.body).not.toHaveProperty('password');
    userId = res.body.id;
  });

  it('should authenticate user and return access token with organizations', async () => {
    const loginData = {
      email: testUser.email,
      password: testUser.password,
    };
    const res = await request(app.getHttpServer()).post('/auth/login').send(loginData).expect(200);

    // Verify basic response structure
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('expiresIn', 900);
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('organizations');

    // Verify user object
    expect(res.body.user).toHaveProperty('id', userId);
    expect(res.body.user).toHaveProperty('email', testUser.email);
    expect(res.body.user).toHaveProperty('name', testUser.name);
    expect(res.body.user).toHaveProperty('role');
    expect(res.body.user).not.toHaveProperty('password');

    // Verify primary organization
    const primaryOrgFromArray = res.body.organizations.find(
      (org: OrganizationResponse) => org.isPrimary,
    );
    expect(primaryOrgFromArray).toBeDefined();
    expect(primaryOrgFromArray).toHaveProperty('id');
    expect(primaryOrgFromArray).toHaveProperty('name');

    // Verify organizations array
    expect(Array.isArray(res.body.organizations)).toBe(true);
    expect(res.body.organizations.length).toBeGreaterThan(0);

    // Verify first organization has required properties
    const firstOrg = res.body.organizations[0];
    expect(firstOrg).toHaveProperty('id');
    expect(firstOrg).toHaveProperty('name');
    expect(firstOrg).toHaveProperty('role');
    expect(firstOrg).toHaveProperty('isPrimary');

    // Verify primary organization is marked correctly
    const primaryOrg = res.body.organizations.find((org: OrganizationResponse) => org.isPrimary);
    expect(primaryOrg).toBeDefined();

    // Save refresh token from cookie for logout
    const cookies = res.headers['set-cookie'];
    const cookiesArr = Array.isArray(cookies) ? cookies : [cookies];
    const refreshCookie = cookiesArr.find((c: string) => c.startsWith('refreshToken='));
    refreshToken = refreshCookie?.split(';')[0]?.split('=')[1];
    expect(refreshToken).toBeDefined();
  });

  it('should prioritize OWNER organization as primary', async () => {
    // Create a completely new user for this test to ensure independence
    const testUserData = {
      email: `test-user-${Math.random().toString(36).substring(7)}@test.com`,
      password: 'TestPassword123!',
      name: 'Test User',
    };

    // Create user without orgId so they become OWNER of their own organization
    const signupData = {
      ...testUserData,
      // Don't provide orgId - this will create a new organization where user is OWNER
    };
    const signupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send(signupData)
      .expect(201);
    const testUserId = signupRes.body.id;

    // Create a second organization where the user will be a member
    const secondOrg = await prisma.organization.create({
      data: {
        name: 'Second Organization',
      },
    });

    // Add user as a member to the second organization
    await prisma.orgMember.create({
      data: {
        orgId: secondOrg.id,
        userId: testUserId,
        role: 'member',
        status: OrgMemberStatus.active,
      },
    });

    // Login again to test the new organization list
    const loginData = {
      email: testUserData.email,
      password: testUserData.password,
    };
    const res = await request(app.getHttpServer()).post('/auth/login').send(loginData).expect(200);

    // Verify user has multiple organizations
    expect(res.body.organizations.length).toBe(2);

    // Find the primary organization (should be the one where user is OWNER)
    const primaryOrg = res.body.organizations.find((org: OrganizationResponse) => org.isPrimary);
    expect(primaryOrg).toBeDefined();
    expect(primaryOrg.role).toBe('owner');

    // Verify the primary organization exists and has correct role
    expect(primaryOrg).toBeDefined();

    // Verify only one organization is marked as primary
    const primaryOrgs = res.body.organizations.filter((org: OrganizationResponse) => org.isPrimary);
    expect(primaryOrgs.length).toBe(1);

    // Clean up the second organization
    await prisma.orgMember.deleteMany({
      where: { orgId: secondOrg.id },
    });
    await prisma.organization.delete({
      where: { id: secondOrg.id },
    });
  });

  it('should logout user successfully', async () => {
    // Send refreshToken in body (or cookie)
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(200);
    expect(res.body).toEqual({ success: true });
  });

  describe('Password Reset Flow', () => {
    let passwordResetUserId: string;
    let resetToken: string;

    it('should create a user for password reset testing', async () => {
      const signupData = {
        ...passwordResetUser,
        orgId,
      };
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send(signupData)
        .expect(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('email', passwordResetUser.email);
      passwordResetUserId = res.body.id;
    });

    it('should request password reset for existing user', async () => {
      const forgotPasswordData = {
        email: passwordResetUser.email,
      };

      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send(forgotPasswordData)
        .expect(201);

      expect(res.body).toEqual({
        message: 'Password reset link has been sent to your email.',
        success: true,
      });

      // Verify that a password reset token was created in the database
      const resetTokenRecord = await prisma.passwordResetToken.findFirst({
        where: { userId: passwordResetUserId },
        include: { user: true },
      });

      expect(resetTokenRecord).toBeDefined();
      expect(resetTokenRecord.user.email).toBe(passwordResetUser.email);
      expect(resetTokenRecord.expiresAt).toBeInstanceOf(Date);
      expect(resetTokenRecord.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Save the token for the reset test
      resetToken = resetTokenRecord.token;
    });

    it('should successfully reset password with valid token', async () => {
      const newPassword = 'NewSecurePassword456!';
      const resetPasswordData = {
        token: resetToken,
        password: newPassword,
        email: passwordResetUser.email,
      };

      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send(resetPasswordData)
        .expect(201);

      expect(res.body).toEqual({
        message: 'Password has been successfully reset.',
        success: true,
      });

      // Verify that the password reset token was deleted
      const resetTokenRecord = await prisma.passwordResetToken.findUnique({
        where: { token: resetToken },
      });
      expect(resetTokenRecord).toBeNull();

      // Verify that the user can now login with the new password
      const loginData = {
        email: passwordResetUser.email,
        password: newPassword,
      };

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      expect(loginRes.body).toHaveProperty('accessToken');
      expect(loginRes.body).toHaveProperty('user');
      expect(loginRes.body.user).toHaveProperty('id', passwordResetUserId);
      expect(loginRes.body.user).toHaveProperty('email', passwordResetUser.email);
    });

    it('should handle multiple password reset requests for the same user', async () => {
      // Request another password reset
      const forgotPasswordData = {
        email: passwordResetUser.email,
      };

      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send(forgotPasswordData)
        .expect(201);

      expect(res.body).toEqual({
        message: 'Password reset link has been sent to your email.',
        success: true,
      });

      // Verify that a new token was created (old one should be replaced)
      const resetTokenRecords = await prisma.passwordResetToken.findMany({
        where: { userId: passwordResetUserId },
      });

      expect(resetTokenRecords).toHaveLength(1);
      expect(resetTokenRecords[0].token).not.toBe(resetToken); // Should be a new token
    });

    it('should verify audit logs were created for password reset actions', async () => {
      // Debug: Log all audit logs for this user
      const allUserLogs = await prisma.auditLog.findMany({
        where: { actorUserId: passwordResetUserId },
      });
      console.log('All audit logs for user:', allUserLogs);
      
      const auditLogs = await prisma.auditLog.findMany({
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
      expect((requestLog.requestData as any).body).toHaveProperty('email', passwordResetUser.email);
      expect(requestLog.requestData as any).toHaveProperty('ipAddress');
      expect(requestLog).toHaveProperty('actorUserId', passwordResetUserId);

      // Check for password reset completion log
      const completionLog = auditLogs.find((log) => log.action === 'password.reset.completed');
      expect(completionLog).toBeDefined();
      expect((completionLog.requestData as any).body).toHaveProperty('email', passwordResetUser.email);
      expect(completionLog.requestData as any).toHaveProperty('ipAddress');
      expect(completionLog).toHaveProperty('actorUserId', passwordResetUserId);
      expect((completionLog.requestData as any).body).toHaveProperty('resetAt');
    });
  });
});
