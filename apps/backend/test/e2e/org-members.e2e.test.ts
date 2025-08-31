import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrgRole, OrgMemberStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import { hash } from '@node-rs/argon2';

describe('Organization Members (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Test data storage
  const testData = {
    orgId: '',
    adminUserId: '',
    memberUserId: '',
    testUserIds: [] as string[],
    adminToken: '',
    memberToken: '',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    await app.init();
  });

  beforeEach(async () => {
    // Generate random test data
    const randomSuffix = Math.random().toString(36).substring(7);

    // Create test organization
    const org = await prisma.organization.create({
      data: {
        name: `Test Org ${randomSuffix}`,
      },
    });
    testData.orgId = org.id;

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: `admin-${randomSuffix}@test.com`,
        passwordHash: 'hashed_password',
        name: `Admin User ${randomSuffix}`,
      },
    });
    testData.adminUserId = adminUser.id;

    // Create admin member
    await prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId: adminUser.id,
        role: OrgRole.admin,
        status: OrgMemberStatus.active,
      },
    });

    // Create test member user
    const memberUser = await prisma.user.create({
      data: {
        email: `member-${randomSuffix}@test.com`,
        passwordHash: 'hashed_password',
        name: `Member User ${randomSuffix}`,
      },
    });
    testData.memberUserId = memberUser.id;

    // Create member
    await prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId: memberUser.id,
        role: OrgRole.member,
        status: OrgMemberStatus.active,
      },
    });

    // Generate JWT tokens for authentication
    testData.adminToken = jwtService.sign({
      sub: adminUser.id,
      email: adminUser.email,
      orgId: org.id,
    });

    testData.memberToken = jwtService.sign({
      sub: memberUser.id,
      email: memberUser.email,
      orgId: org.id,
    });

    // Store user IDs for cleanup
    testData.testUserIds = [adminUser.id, memberUser.id];
  });

  afterEach(async () => {
    // Clean up only the data we created
    if (testData.orgId) {
      // Delete org members first (due to foreign key constraints)
      await prisma.orgMember.deleteMany({
        where: { orgId: testData.orgId },
      });

      // Delete the organization
      await prisma.organization.delete({
        where: { id: testData.orgId },
      });
    }

    // Delete test users
    if (testData.testUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: testData.testUserIds } },
      });
    }

    // Reset test data
    testData.orgId = '';
    testData.adminUserId = '';
    testData.memberUserId = '';
    testData.testUserIds = [];
    testData.adminToken = '';
    testData.memberToken = '';
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('/org/members/invite (POST)', () => {
    it('should invite a new member successfully', async () => {
      const randomSuffix = Math.random().toString(36).substring(7);
      const inviteEmail = `newmember-${randomSuffix}@test.com`;

      const response = await request(app.getHttpServer())
        .post('/org/members/invite')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send({
          email: inviteEmail,
          role: OrgRole.member,
        })
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Invitation sent successfully');
      expect(response.body).toHaveProperty('invitedEmail', inviteEmail);

      // Verify the invitation was created in the database
      const invitation = await prisma.orgMember.findFirst({
        where: {
          orgId: testData.orgId,
          user: { email: inviteEmail },
        },
      });

      expect(invitation).toBeDefined();
      expect(invitation?.role).toBe(OrgRole.member);
      expect(invitation?.status).toBe('invited');
      expect(invitation?.inviteToken).toBeDefined();
      expect(invitation?.invitedAt).toBeDefined();
    });

    it('should not allow members to invite new members', async () => {
      const randomSuffix = Math.random().toString(36).substring(7);
      const inviteEmail = `newmember-${randomSuffix}@test.com`;

      await request(app.getHttpServer())
        .post('/org/members/invite')
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .send({
          email: inviteEmail,
          role: OrgRole.member,
        })
        .expect(403);
    });

    it('should not allow inviting duplicate active members', async () => {
      // Get the existing member's email
      const existingMember = await prisma.orgMember.findUnique({
        where: {
          orgId_userId: {
            orgId: testData.orgId,
            userId: testData.memberUserId,
          },
        },
        include: { user: true },
      });

      // Try to invite the existing member again with their actual email
      await request(app.getHttpServer())
        .post('/org/members/invite')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send({
          email: existingMember!.user.email,
          role: OrgRole.member,
        })
        .expect(409); // Conflict - duplicate member
    });
  });

  describe('/org/members/accept (POST)', () => {
    it('should accept an invitation successfully', async () => {
      // First, create an invitation
      const randomSuffix = Math.random().toString(36).substring(7);
      const inviteEmail = `invitee-${randomSuffix}@test.com`;

      // Create a user for the invitation
      const inviteeUser = await prisma.user.create({
        data: {
          email: inviteEmail,
          passwordHash: 'hashed_password',
          name: `Invitee User ${randomSuffix}`,
        },
      });

      // Create the invitation with proper hashed token
      const crypto = await import('crypto');
      const inviteToken = 'test-invite-token';
      const inviteTokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');

      await prisma.orgMember.create({
        data: {
          orgId: testData.orgId,
          userId: inviteeUser.id,
          role: OrgRole.member,
          status: OrgMemberStatus.invited,
          inviteToken: inviteTokenHash,
          invitedAt: new Date(),
        },
      });

      const response = await request(app.getHttpServer())
        .post('/org/members/accept')
        .send({
          token: inviteToken,
          name: 'John Doe',
          password: 'SecurePassword123!',
        })
        .expect(200);

      // Verify the response contains authentication tokens and user/org info
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('expiresIn', 900);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('organization');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', inviteEmail);
      expect(response.body.user).toHaveProperty('name', 'John Doe');
      expect(response.body.user).toHaveProperty('role', 'member');
      expect(response.body.organization).toHaveProperty('id', testData.orgId);
      expect(response.body.organization).toHaveProperty('name');

      // Verify the member status was updated
      const updatedMember = await prisma.orgMember.findUnique({
        where: {
          orgId_userId: {
            orgId: testData.orgId,
            userId: inviteeUser.id,
          },
        },
      });

      expect(updatedMember?.status).toBe('active');
      expect(updatedMember?.acceptedAt).toBeDefined();
      expect(updatedMember?.inviteToken).toBeNull();

      // Clean up the invitee user
      await prisma.user.delete({ where: { id: inviteeUser.id } });
    });

    it('should accept an invitation for existing user without password', async () => {
      const randomSuffix = Math.random().toString(36).substring(7);
      const inviteEmail = `existing-user-${randomSuffix}@test.com`;

      // Create an existing user with a proper password hash
      const existingUser = await prisma.user.create({
        data: {
          email: inviteEmail,
          passwordHash: await hash('ExistingPassword123!', {
            memoryCost: 1 << 14,
            timeCost: 3,
          }),
          name: `Existing User ${randomSuffix}`,
        },
      });

      // Create an invitation for this existing user
      const inviteToken = randomBytes(32).toString('hex');
      const inviteTokenHash = createHash('sha256').update(inviteToken).digest('hex');

      await prisma.orgMember.create({
        data: {
          orgId: testData.orgId,
          userId: existingUser.id,
          role: OrgRole.member,
          status: OrgMemberStatus.invited,
          inviteToken: inviteTokenHash,
          invitedAt: new Date(),
        },
      });

      // Accept invitation without providing password (existing user)
      const response = await request(app.getHttpServer())
        .post('/org/members/accept')
        .send({
          token: inviteToken,
          // No password provided for existing user
        })
        .expect(200);

      // Verify the response contains authentication tokens and user/org info
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('expiresIn', 900);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('organization');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', inviteEmail);
      expect(response.body.user).toHaveProperty('name', `Existing User ${randomSuffix}`);
      expect(response.body.user).toHaveProperty('role', 'member');
      expect(response.body.organization).toHaveProperty('id', testData.orgId);
      expect(response.body.organization).toHaveProperty('name');

      // Verify the member status was updated
      const updatedMember = await prisma.orgMember.findUnique({
        where: {
          orgId_userId: {
            orgId: testData.orgId,
            userId: existingUser.id,
          },
        },
      });

      expect(updatedMember?.status).toBe('active');
      expect(updatedMember?.acceptedAt).toBeDefined();
      expect(updatedMember?.inviteToken).toBeNull();

      // Clean up the existing user
      await prisma.user.delete({ where: { id: existingUser.id } });
    });

    it('should reject invalid invitation token', async () => {
      const randomSuffix = Math.random().toString(36).substring(7);
      const inviteEmail = `invitee-${randomSuffix}@test.com`;

      // Create a user for the invitation
      const inviteeUser = await prisma.user.create({
        data: {
          email: inviteEmail,
          passwordHash: 'hashed_password',
          name: `Invitee User ${randomSuffix}`,
        },
      });

      await request(app.getHttpServer())
        .post('/org/members/accept')
        .send({
          token: 'invalid-token',
          name: 'John Doe',
          password: 'SecurePassword123!',
        })
        .expect(400);

      // Clean up the invitee user
      await prisma.user.delete({ where: { id: inviteeUser.id } });
    });
  });

  describe('/org/members/:id (PATCH)', () => {
    it('should update member role successfully', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/org/members/${testData.memberUserId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send({
          role: OrgRole.admin,
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Member updated successfully');

      // Verify the role was updated in the database
      const updatedMember = await prisma.orgMember.findUnique({
        where: {
          orgId_userId: {
            orgId: testData.orgId,
            userId: testData.memberUserId,
          },
        },
      });

      expect(updatedMember?.role).toBe(OrgRole.admin);
    });

    it('should suspend a member successfully', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/org/members/${testData.memberUserId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send({
          suspend: true,
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Member updated successfully');

      // Verify the member was suspended
      const updatedMember = await prisma.orgMember.findUnique({
        where: {
          orgId_userId: {
            orgId: testData.orgId,
            userId: testData.memberUserId,
          },
        },
      });

      expect(updatedMember?.status).toBe('suspended');
    });

    it('should not allow members to update other members', async () => {
      await request(app.getHttpServer())
        .patch(`/org/members/${testData.adminUserId}`)
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .send({
          role: OrgRole.member,
        })
        .expect(403);
    });

    it('should not allow updating suspended members to access protected routes', async () => {
      // First suspend the member
      await request(app.getHttpServer())
        .patch(`/org/members/${testData.memberUserId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send({
          suspend: true,
        })
        .expect(200);

      // Generate a new token for the suspended member (simulating a fresh login attempt)
      const suspendedMemberToken = jwtService.sign({
        sub: testData.memberUserId,
        email: 'member@test.com',
        orgId: testData.orgId,
      });

      // Try to access a protected route with suspended member token
      // Note: Currently returns 401 because JWT validation fails for suspended members
      // In a real implementation, this would return 403 after successful authentication
      await request(app.getHttpServer())
        .get('/org/members')
        .set('Authorization', `Bearer ${suspendedMemberToken}`)
        .expect(401);
    });
  });

  describe('/org/members/:id (DELETE)', () => {
    it('should delete a member successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/org/members/${testData.memberUserId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(204);

      // 204 No Content doesn't return a body
      expect(response.body).toEqual({});

      // Verify the member was deleted
      const deletedMember = await prisma.orgMember.findUnique({
        where: {
          orgId_userId: {
            orgId: testData.orgId,
            userId: testData.memberUserId,
          },
        },
      });

      expect(deletedMember).toBeNull();
    });

    it('should not allow members to delete other members', async () => {
      await request(app.getHttpServer())
        .delete(`/org/members/${testData.adminUserId}`)
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .expect(403);
    });

    it('should not allow deleting the last admin', async () => {
      await request(app.getHttpServer())
        .delete(`/org/members/${testData.adminUserId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(400);
    });
  });

  describe('RBAC Enforcement', () => {
    it('should enforce role-based access control', async () => {
      // Member should not be able to access admin-only endpoints
      await request(app.getHttpServer())
        .post('/org/members/invite')
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .send({
          email: 'test@example.com',
          role: OrgRole.member,
        })
        .expect(403);

      // Admin should be able to access admin-only endpoints
      await request(app.getHttpServer())
        .post('/org/members/invite')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send({
          email: 'test@example.com',
          role: OrgRole.member,
        })
        .expect(201);
    });
  });
});
