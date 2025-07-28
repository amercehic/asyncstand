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
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '@/auth/guards/roles.guard';
import { OrgMembersService } from '@/auth/services/org-members.service';
import { InviteMemberDto } from '@/auth/dto/invite-member.dto';
import { AcceptInviteDto } from '@/auth/dto/accept-invite.dto';
import { UpdateMemberDto } from '@/auth/dto/update-member.dto';
import { CurrentOrg } from '@/auth/decorators/current-org.decorator';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { OrgRole } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import {
  SwaggerListMembers,
  SwaggerInviteMember,
  SwaggerAcceptInvite,
  SwaggerUpdateMember,
  SwaggerDeleteMember,
} from '@/swagger/org-members.swagger';

@ApiTags('Organization Members')
@Controller('org/members')
export class OrgMembersController {
  constructor(private readonly orgMembersService: OrgMembersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @SwaggerListMembers()
  async listMembers(@CurrentOrg() orgId: string) {
    return this.orgMembersService.listMembers(orgId);
  }

  @Post('invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @SwaggerInviteMember()
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
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.orgMembersService.acceptInvite(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @SwaggerUpdateMember()
  async updateMember(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.orgMembersService.updateMember(orgId, actorUserId, memberId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @SwaggerDeleteMember()
  async deleteMember(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') memberId: string,
  ) {
    return this.orgMembersService.deleteMember(orgId, actorUserId, memberId);
  }
}
