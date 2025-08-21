import {
  Controller,
  Post,
  Patch,
  Delete,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '@/auth/guards/roles.guard';
import { OrgMembersService } from '@/auth/services/org-members.service';
import { AuthService } from '@/auth/services/auth.service';
import { InviteMemberDto } from '@/auth/dto/invite-member.dto';
import { AcceptInviteDto } from '@/auth/dto/accept-invite.dto';
import { UpdateMemberDto } from '@/auth/dto/update-member.dto';
import { CurrentOrg } from '@/auth/decorators/current-org.decorator';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { OrgRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  SwaggerListMembers,
  SwaggerInviteMember,
  SwaggerAcceptInvite,
  SwaggerUpdateMember,
  SwaggerDeleteMember,
} from '@/swagger/org-members.swagger';
import { Audit } from '@/common/audit/audit.decorator';
import { AuditCategory, AuditSeverity } from '@/common/audit/types';
import { getClientIp } from '@/common/http/ip.util';

@ApiTags('Organization Members')
@ApiBearerAuth('JWT-auth')
@Controller('org/members')
export class OrgMembersController {
  constructor(
    private readonly orgMembersService: OrgMembersService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @SwaggerListMembers()
  async listMembers(@CurrentOrg() orgId: string) {
    return this.orgMembersService.listMembers(orgId);
  }

  @Post('invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(OrgRole.owner, OrgRole.admin)
  @SwaggerInviteMember()
  @Audit({
    action: 'org_member.invited',
    category: AuditCategory.USER_MANAGEMENT,
    severity: AuditSeverity.MEDIUM,
    resourcesFromResult: (result) => [
      { type: 'org_member', id: result?.inviteId, action: 'CREATED' },
    ],
  })
  async inviteMember(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.orgMembersService.inviteMember(orgId, actorUserId, dto);
  }

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @UseGuards()
  @SwaggerAcceptInvite()
  @Audit({
    action: 'org_member.invite_accepted',
    category: AuditCategory.USER_MANAGEMENT,
    severity: AuditSeverity.MEDIUM,
    redactRequestBodyPaths: ['password'],
    resourcesFromResult: (result) => [
      { type: 'org_member', id: result?.userId, action: 'CREATED' },
    ],
  })
  async acceptInvite(@Body() dto: AcceptInviteDto, @Req() req: Request) {
    const ip = getClientIp(req);
    return this.authService.acceptInvite(dto.token, dto.name, dto.password, ip);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(OrgRole.owner, OrgRole.admin)
  @SwaggerUpdateMember()
  @Audit({
    action: 'org_member.updated',
    category: AuditCategory.USER_MANAGEMENT,
    severity: AuditSeverity.MEDIUM,
    resourcesFromRequest: (req) => [{ type: 'org_member', id: req.params.id, action: 'UPDATED' }],
  })
  async updateMember(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.orgMembersService.updateMember(orgId, actorUserId, memberId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(OrgRole.owner, OrgRole.admin)
  @SwaggerDeleteMember()
  @Audit({
    action: 'org_member.deleted',
    category: AuditCategory.USER_MANAGEMENT,
    severity: AuditSeverity.HIGH,
    resourcesFromRequest: (req) => [{ type: 'org_member', id: req.params.id, action: 'DELETED' }],
  })
  async deleteMember(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id', ParseUUIDPipe) memberId: string,
  ) {
    return this.orgMembersService.deleteMember(orgId, actorUserId, memberId);
  }
}
