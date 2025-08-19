import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { OrgRole } from '@prisma/client';

describe('Organization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Test data storage
  const testData = {
    orgId: '',
    ownerUserId: '',
    adminUserId: '',
    memberUserId: '',
    ownerToken: '',
    adminToken: '',
    memberToken: '',
    testUserIds: [] as string[],
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
    // Clean up existing test data
    await cleanupTestData();

    // Generate random test data
    const randomSuffix = Math.random().toString(36).substring(7);

    // Create test organization
    const org = await prisma.organization.create({
      data: {
        name: `Organization E2E Test Org ${randomSuffix}`,
      },
    });
    testData.orgId = org.id;

    // Create owner user
    const ownerUser = await prisma.user.create({
      data: {
        email: `org-owner-${randomSuffix}@test.com`,
        passwordHash: 'hashed_password',
        name: `Owner User ${randomSuffix}`,
      },
    });
    testData.ownerUserId = ownerUser.id;

    // Create owner member
    await prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId: ownerUser.id,
        role: OrgRole.owner,
        status: 'active',
      },
    });

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: `org-admin-${randomSuffix}@test.com`,
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
        status: 'active',
      },
    });

    // Create member user
    const memberUser = await prisma.user.create({
      data: {
        email: `org-member-${randomSuffix}@test.com`,
        passwordHash: 'hashed_password',
        name: `Member User ${randomSuffix}`,
      },
    });
    testData.memberUserId = memberUser.id;

    // Create regular member
    await prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId: memberUser.id,
        role: OrgRole.member,
        status: 'active',
      },
    });

    // Generate JWT tokens for testing (matching expected JWT structure)
    testData.ownerToken = jwtService.sign({
      sub: ownerUser.id,
      orgId: org.id,
      role: 'owner',
    });

    testData.adminToken = jwtService.sign({
      sub: adminUser.id,
      orgId: org.id,
      role: 'admin',
    });

    testData.memberToken = jwtService.sign({
      sub: memberUser.id,
      orgId: org.id,
      role: 'member',
    });

    testData.testUserIds = [ownerUser.id, adminUser.id, memberUser.id];
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function cleanupTestData() {
    if (testData.orgId) {
      await prisma.orgMember.deleteMany({ where: { orgId: testData.orgId } });
      await prisma.organization.deleteMany({ where: { id: testData.orgId } });
    }
    for (const userId of testData.testUserIds) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  }

  describe('GET /org', () => {
    it('should return organization details for owner', async () => {
      return request(app.getHttpServer())
        .get('/org')
        .set('Authorization', `Bearer ${testData.ownerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', testData.orgId);
          expect(res.body).toHaveProperty('name');
          expect(res.body.name).toContain('Organization E2E Test Org');
        });
    });

    it('should return organization details for admin', async () => {
      return request(app.getHttpServer())
        .get('/org')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', testData.orgId);
          expect(res.body).toHaveProperty('name');
          expect(res.body.name).toContain('Organization E2E Test Org');
        });
    });

    it('should return organization details for regular member', async () => {
      return request(app.getHttpServer())
        .get('/org')
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', testData.orgId);
          expect(res.body).toHaveProperty('name');
        });
    });

    it('should return 401 for unauthenticated request', async () => {
      return request(app.getHttpServer()).get('/org').expect(401);
    });

    it('should return 401 for invalid token', async () => {
      return request(app.getHttpServer())
        .get('/org')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('PATCH /org', () => {
    it('should update organization name for owner', async () => {
      const randomSuffix = Math.random().toString(36).substring(7);
      const updateData = {
        name: `Updated Organization Name ${randomSuffix}`,
      };

      return request(app.getHttpServer())
        .patch('/org')
        .set('Authorization', `Bearer ${testData.ownerToken}`)
        .send(updateData)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', testData.orgId);
          expect(res.body).toHaveProperty('name', updateData.name);
        });
    });

    it('should return 403 for admin trying to update organization', async () => {
      const updateData = {
        name: 'Admin Cannot Update This',
      };

      return request(app.getHttpServer())
        .patch('/org')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(updateData)
        .expect(403);
    });

    it('should return 403 for regular member trying to update organization', async () => {
      const updateData = {
        name: 'Member Cannot Update This',
      };

      return request(app.getHttpServer())
        .patch('/org')
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .send(updateData)
        .expect(403);
    });

    it('should return 401 for unauthenticated request', async () => {
      const updateData = {
        name: 'Unauthenticated Update Attempt',
      };

      return request(app.getHttpServer()).patch('/org').send(updateData).expect(401);
    });

    it('should handle special characters in organization name', async () => {
      const randomSuffix = Math.random().toString(36).substring(7);
      const updateData = {
        name: `Special Chars Org ${randomSuffix} !@#$%^&*()`,
      };

      return request(app.getHttpServer())
        .patch('/org')
        .set('Authorization', `Bearer ${testData.ownerToken}`)
        .send(updateData)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('name', updateData.name);
        });
    });

    it('should verify updated organization is persisted', async () => {
      const randomSuffix = Math.random().toString(36).substring(7);
      const updateData = {
        name: `Persisted Update Test ${randomSuffix}`,
      };

      // Update the organization
      await request(app.getHttpServer())
        .patch('/org')
        .set('Authorization', `Bearer ${testData.ownerToken}`)
        .send(updateData)
        .expect(200);

      // Verify the update by getting the organization
      return request(app.getHttpServer())
        .get('/org')
        .set('Authorization', `Bearer ${testData.ownerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('name', updateData.name);
        });
    });
  });
});
