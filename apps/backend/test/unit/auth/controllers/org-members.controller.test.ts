import { Test, TestingModule } from '@nestjs/testing';
import { OrgMembersController } from '@/auth/controllers/org-members.controller';
import { OrgMembersService } from '@/auth/services/org-members.service';
import { AuthService } from '@/auth/services/auth.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { InviteMemberDto } from '@/auth/dto/invite-member.dto';
import { AcceptInviteDto } from '@/auth/dto/accept-invite.dto';
import { UpdateMemberDto } from '@/auth/dto/update-member.dto';
import { OrgRole, OrgMemberStatus } from '@prisma/client';
import { Request } from 'express';

describe('OrgMembersController', () => {
  let controller: OrgMembersController;
  let mockOrgMembersService: jest.Mocked<OrgMembersService>;
  let mockAuthService: jest.Mocked<AuthService>;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';
  const mockMemberId = 'member-123';

  beforeEach(async () => {
    mockOrgMembersService = {
      listMembers: jest.fn(),
      inviteMember: jest.fn(),
      updateMember: jest.fn(),
      deleteMember: jest.fn(),
    } as unknown as jest.Mocked<OrgMembersService>;

    mockAuthService = {
      acceptInvite: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrgMembersController],
      providers: [
        { provide: OrgMembersService, useValue: mockOrgMembersService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<OrgMembersController>(OrgMembersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listMembers', () => {
    it('should return list of organization members', async () => {
      const expectedMembers = {
        members: [
          {
            id: 'member1',
            email: 'member1@example.com',
            name: 'Member 1',
            role: OrgRole.admin,
            status: OrgMemberStatus.active,
            joinedAt: new Date(),
          },
          {
            id: 'member2',
            email: 'member2@example.com',
            name: 'Member 2',
            role: OrgRole.member,
            status: OrgMemberStatus.active,
            joinedAt: new Date(),
          },
        ],
      };
      mockOrgMembersService.listMembers.mockResolvedValue(expectedMembers);

      const result = await controller.listMembers(mockOrgId);

      expect(result).toEqual(expectedMembers);
      expect(mockOrgMembersService.listMembers).toHaveBeenCalledWith(mockOrgId);
    });
  });

  describe('inviteMember', () => {
    it('should invite member to organization', async () => {
      const inviteDto: InviteMemberDto = { email: 'test@example.com', role: OrgRole.member };
      const expectedResult = {
        message: 'Invitation sent successfully',
        invitedEmail: 'test@example.com',
        inviteToken: 'invite-token-123',
      };
      mockOrgMembersService.inviteMember.mockResolvedValue(expectedResult);

      const result = await controller.inviteMember(mockOrgId, mockUserId, inviteDto);

      expect(result).toEqual(expectedResult);
      expect(mockOrgMembersService.inviteMember).toHaveBeenCalledWith(
        mockOrgId,
        mockUserId,
        inviteDto,
      );
    });
  });

  describe('acceptInvite', () => {
    it('should accept invitation', async () => {
      const acceptDto: AcceptInviteDto = {
        token: 'invite-token',
        name: 'Test User',
        password: 'password123',
      };
      const mockReq = {
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
        headers: {},
      } as Request;
      const expectedResult = {
        accessToken: 'jwt-token',
        expiresIn: 3600,
        refreshToken: 'refresh-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: OrgRole.member,
        },
        organization: {
          id: 'org-123',
          name: 'Test Organization',
        },
      };
      mockAuthService.acceptInvite.mockResolvedValue(expectedResult);

      const result = await controller.acceptInvite(acceptDto, mockReq);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.acceptInvite).toHaveBeenCalledWith(
        acceptDto.token,
        acceptDto.name,
        acceptDto.password,
        '127.0.0.1',
      );
    });
  });

  describe('updateMember', () => {
    it('should update member', async () => {
      const updateDto: UpdateMemberDto = { role: OrgRole.admin };
      const expectedResult = {
        message: 'Member updated successfully',
        member: {
          id: mockMemberId,
          email: 'member@example.com',
          role: OrgRole.admin,
          status: OrgMemberStatus.active,
        },
      };
      mockOrgMembersService.updateMember.mockResolvedValue(expectedResult);

      const result = await controller.updateMember(mockOrgId, mockUserId, mockMemberId, updateDto);

      expect(result).toEqual(expectedResult);
      expect(mockOrgMembersService.updateMember).toHaveBeenCalledWith(
        mockOrgId,
        mockUserId,
        mockMemberId,
        updateDto,
      );
    });
  });

  describe('deleteMember', () => {
    it('should delete member', async () => {
      const expectedResult = { message: 'Member deleted successfully' };
      mockOrgMembersService.deleteMember.mockResolvedValue(expectedResult);

      const result = await controller.deleteMember(mockOrgId, mockUserId, mockMemberId);

      expect(result).toEqual(expectedResult);
      expect(mockOrgMembersService.deleteMember).toHaveBeenCalledWith(
        mockOrgId,
        mockUserId,
        mockMemberId,
      );
    });
  });
});
