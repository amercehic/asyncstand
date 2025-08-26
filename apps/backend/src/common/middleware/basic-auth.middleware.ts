import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class BasicAuthMiddleware implements NestMiddleware {
  constructor(private configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Skip auth for health checks
    if (req.path === '/health') {
      return next();
    }

    // Only enable in production/staging if configured
    const basicAuthEnabled = this.configService.get<boolean>('BASIC_AUTH_ENABLED', false);
    if (!basicAuthEnabled) {
      return next();
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Restricted"');
      throw new UnauthorizedException('Authentication required');
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    const validUsername = this.configService.get<string>('BASIC_AUTH_USERNAME');
    const validPassword = this.configService.get<string>('BASIC_AUTH_PASSWORD');

    if (username !== validUsername || password !== validPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    next();
  }
}