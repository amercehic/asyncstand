import { Controller, Get } from '@nestjs/common';
import { AppService } from '@/app.service';
import { ApiTags } from '@nestjs/swagger';
import { SwaggerGetHello, SwaggerGetHealth } from '@/app.swagger';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @SwaggerGetHello()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @SwaggerGetHealth()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      envInfo: this.appService.getEnvironmentInfo(),
    };
  }
}
