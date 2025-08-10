import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthService } from '@/auth/services/auth.service';
import { JwtStrategy } from '@/auth/jwt.strategy';
import { AuthController } from '@/auth/controllers/auth.controller';
import { OrgMembersController } from '@/auth/controllers/org-members.controller';
import { OrganizationController } from '@/auth/controllers/organization.controller';
import { OrgMembersService } from '@/auth/services/org-members.service';
import { OrganizationService } from '@/auth/services/organization.service';
import { UserUtilsService } from '@/auth/services/user-utils.service';
import { TokenService } from '@/auth/services/token.service';
import { UserService } from '@/auth/services/user.service';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { CleanupExpiredInvitesJob } from '@/auth/jobs/cleanup-expired-invites.job';
import { PasswordResetService } from '@/auth/services/password-reset.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { AuditLogService } from '@/common/audit/audit-log.service';

@Module({
  imports: [
    PassportModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute for tests
        limit: 100, // 100 requests per minute for tests
      },
    ]),
    // Only import ScheduleModule in non-test environments
    ...(process.env.NODE_ENV !== 'test' ? [ScheduleModule.forRoot()] : []),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwtSecret'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    OrgMembersService,
    OrganizationService,
    UserUtilsService,
    TokenService,
    UserService,
    RolesGuard,
    // Only include CleanupExpiredInvitesJob in non-test environments
    ...(process.env.NODE_ENV !== 'test' ? [CleanupExpiredInvitesJob] : []),
    PasswordResetService,
    PrismaService,
    LoggerService,
    AuditLogService,
  ],
  controllers: [AuthController, OrgMembersController, OrganizationController],
})
export class AuthModule {}
