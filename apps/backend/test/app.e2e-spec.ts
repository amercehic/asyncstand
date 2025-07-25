import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('GET /', () => {
    it('should return hello message', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect((res) => {
          expect(res.text).toContain('Hello from AsyncStand Backend!');
        });
    });
  });

  describe('GET /health', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('version', '1.0.0');
          expect(res.body).toHaveProperty('envInfo');
          expect(res.body.envInfo).toHaveProperty('nodeEnv');
          expect(res.body.envInfo).toHaveProperty('port');
          expect(res.body.envInfo).toHaveProperty('hasDatabase');
          expect(res.body.envInfo).toHaveProperty('hasJwtSecret');
        });
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
