import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';

describe('AppController', () => {
  let controller: AppController;
  let mockAppService: jest.Mocked<AppService>;

  beforeEach(async () => {
    mockAppService = {
      getHello: jest.fn(),
      getEnvironmentInfo: jest.fn(),
    } as unknown as jest.Mocked<AppService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: mockAppService }],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHello', () => {
    it('should return hello message', () => {
      const expectedMessage = 'Hello World!';
      mockAppService.getHello.mockReturnValue(expectedMessage);

      const result = controller.getHello();

      expect(result).toBe(expectedMessage);
      expect(mockAppService.getHello).toHaveBeenCalled();
    });
  });

  describe('getHealth', () => {
    it('should return health status', () => {
      const mockEnvInfo = {
        nodeEnv: 'test',
        port: 3001,
        hasDatabase: true,
        hasJwtSecret: true,
      };
      mockAppService.getEnvironmentInfo.mockReturnValue(mockEnvInfo);

      const result = controller.getHealth();

      expect(result).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        version: '1.0.0',
        envInfo: mockEnvInfo,
      });
      expect(mockAppService.getEnvironmentInfo).toHaveBeenCalled();
    });
  });
});
