import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';

import { PrismaService } from '@/prisma/prisma.service';

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
    if (orgId) {
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    await app.close();
  });

  it('should create a new user account', async () => {
    const signupData = {
      ...testUser,
      orgId,
      invitationToken: 'test-invitation-token',
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

  it('should authenticate user and return access token', async () => {
    const loginData = {
      email: testUser.email,
      password: testUser.password,
    };
    const res = await request(app.getHttpServer()).post('/auth/login').send(loginData).expect(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('id', userId);
    expect(res.body.user).toHaveProperty('email', testUser.email);
    expect(res.body.user).not.toHaveProperty('password');
    // Save refresh token from cookie for logout
    const cookies = res.headers['set-cookie'];
    const cookiesArr = Array.isArray(cookies) ? cookies : [cookies];
    const refreshCookie = cookiesArr.find((c: string) => c.startsWith('refreshToken='));
    refreshToken = refreshCookie?.split(';')[0]?.split('=')[1];
    expect(refreshToken).toBeDefined();
  });

  it('should logout user successfully', async () => {
    // Send refreshToken in body (or cookie)
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(200);
    expect(res.body).toEqual({ success: true });
  });
});
