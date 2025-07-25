import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from '@/auth/auth.service';
import { JwtStrategy } from '@/auth/jwt.strategy';
import { AuthController } from '@/auth/auth.controller';
import { PasswordResetService } from '@/auth/password-reset.service';
import { PrismaService } from '@/prisma/prisma.service';

@Module({
  imports: [
    PassportModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute for tests
        limit: 100, // 100 requests per minute for tests
      },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [AuthService, JwtStrategy, PasswordResetService, PrismaService],
  controllers: [AuthController],
})
export class AuthModule {}
