import { api } from '@/lib/api-client/client';

export type OrgRole = 'owner' | 'admin' | 'member';

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrgMember {
  id: string;
  email: string;
  name: string;
  role: OrgRole;
  status: 'active' | 'invited';
  joinedAt?: string;
  invitedAt?: string;
  invitedBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface UpdateOrganizationDto {
  name: string;
}

export interface InviteMemberResponse {
  inviteId: string;
  email: string;
  role: OrgRole;
  inviteToken: string;
  expiresAt: string;
}

export const organizationApi = {
  async getOrganization(): Promise<Organization> {
    const response = await api.get<Organization>('/org');
    return response.data;
  },

  async updateOrganization(data: UpdateOrganizationDto): Promise<Organization> {
    const response = await api.patch<Organization>('/org', data);
    return response.data;
  },

  async getMembers(): Promise<OrgMember[]> {
    const response = await api.get<{ members: OrgMember[] }>('/org/members');
    return response.data.members;
  },

  async inviteMember(email: string, role: OrgRole): Promise<InviteMemberResponse> {
    const response = await api.post<InviteMemberResponse>('/org/members/invite', {
      email,
      role,
    });
    return response.data;
  },

  async updateMemberRole(memberId: string, role: OrgRole): Promise<void> {
    await api.patch(`/org/members/${memberId}`, { role });
  },

  async removeMember(memberId: string): Promise<void> {
    await api.delete(`/org/members/${memberId}`);
  },

  async acceptInvite(token: string, name: string, password: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/org/members/accept', {
      token,
      name,
      password,
    });
    return response.data;
  },
};

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: OrgRole;
  };
}
