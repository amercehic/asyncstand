import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';

describe('Email Validation Error Messages', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same global configuration as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Improved Email Validation Messages', () => {
    it('should return user-friendly error message for invalid email in signup', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'invalid-email',
          password: 'TestPassword123!',
          name: 'Test User',
        })
        .expect(400);

      // The improved message should be in the response body
      const responseBody = JSON.stringify(response.body);
      expect(responseBody).toContain(
        'Please provide a valid email address (e.g., user@example.com)',
      );
    });

    it('should return user-friendly error message for invalid email in login', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: '@example.com',
          password: 'password123',
        })
        .expect(400);

      const responseBody = JSON.stringify(response.body);
      expect(responseBody).toContain(
        'Please provide a valid email address (e.g., user@example.com)',
      );
    });

    it('should return user-friendly error message for missing email', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          password: 'TestPassword123!',
          name: 'Test User',
        })
        .expect(400);

      const responseBody = JSON.stringify(response.body);
      expect(responseBody).toContain('Email is required');
    });

    it('should now validate email format in reset-password (previously just checked string)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          token: 'some-token',
          password: 'NewPassword123!',
          email: 'definitely-not-an-email',
        })
        .expect(400);

      const responseBody = JSON.stringify(response.body);
      expect(responseBody).toContain(
        'Please provide a valid email address (e.g., user@example.com)',
      );
    });

    it('should accept valid email addresses', async () => {
      // This test will fail because user doesn't exist, but it shows email validation passes
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'valid@example.com',
          password: 'password123',
        })
        .expect(401); // 401 because user doesn't exist, not 400 for validation error

      // Should not contain email validation error messages
      const responseBody = JSON.stringify(response.body);
      expect(responseBody).not.toContain('Please provide a valid email address');
      expect(responseBody).not.toContain('Email is required');
    });
  });
});
