import request from 'supertest';
import { OrgRole } from '@prisma/client';
import { E2ETestBase } from '@/test/utils/e2e-test-base';

describe('Organization (e2e)', () => {
  const testBase = new E2ETestBase();

  // Test context for current test run
  let testContext: {
    org: { id: string; name: string };
    owner: { id: string; token: string };
    admin: { id: string; token: string };
    member: { id: string; token: string };
  };

  beforeAll(async () => {
    await testBase.setupSuite();
  });

  afterAll(async () => {
    await testBase.teardownSuite();
  });

  beforeEach(async () => {
    await testBase.setupTest();

    // Create complete organization setup
    const setup = await testBase.factory.createOrganizationWithUsers();
    testContext = {
      org: setup.org,
      owner: setup.owner as { id: string; token: string },
      admin: setup.admin as { id: string; token: string },
      member: setup.member as { id: string; token: string },
    };
  });

  afterEach(async () => {
    await testBase.teardownTest();
  });

  describe('GET /org', () => {
    it('should get organization details for owner', async () => {
      const response = await request(testBase.getHttpServer())
        .get('/org')
        .set('Authorization', `Bearer ${testContext.owner.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testContext.org.id);
      expect(response.body).toHaveProperty('name', testContext.org.name);
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });

    it('should get organization details for admin', async () => {
      const response = await request(testBase.getHttpServer())
        .get('/org')
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testContext.org.id);
      expect(response.body).toHaveProperty('name', testContext.org.name);
    });

    it('should get organization details for member', async () => {
      const response = await request(testBase.getHttpServer())
        .get('/org')
        .set('Authorization', `Bearer ${testContext.member.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testContext.org.id);
      expect(response.body).toHaveProperty('name', testContext.org.name);
    });

    it('should require authentication', async () => {
      await request(testBase.getHttpServer()).get('/org').expect(401);
    });

    it('should return 404 for user without organization', async () => {
      // Create user without org membership
      const loneUser = await testBase.factory.createUser({
        email: testBase.isolation.generateEmail('lone'),
      });

      await request(testBase.getHttpServer())
        .get('/org')
        .set('Authorization', `Bearer ${loneUser.token}`)
        .expect(401);
    });
  });

  describe('PATCH /org', () => {
    it('should update organization name (owner)', async () => {
      const updateData = {
        name: testBase.isolation.generateOrgName('updated'),
      };

      const response = await request(testBase.getHttpServer())
        .patch('/org')
        .set('Authorization', `Bearer ${testContext.owner.token}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('id', testContext.org.id);
      expect(response.body).toHaveProperty('name', updateData.name);

      // Verify in database
      const updatedOrg = await testBase.prisma.organization.findUnique({
        where: { id: testContext.org.id },
      });
      expect(updatedOrg?.name).toBe(updateData.name);
    });

    it('should not allow admin to update organization name (owner only)', async () => {
      const updateData = {
        name: testBase.isolation.generateOrgName('admin-updated'),
      };

      await request(testBase.getHttpServer())
        .patch('/org')
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .send(updateData)
        .expect(403);
    });

    it('should not allow members to update organization', async () => {
      const updateData = {
        name: testBase.isolation.generateOrgName('forbidden'),
      };

      await request(testBase.getHttpServer())
        .patch('/org')
        .set('Authorization', `Bearer ${testContext.member.token}`)
        .send(updateData)
        .expect(403);
    });

    it('should validate organization name', async () => {
      const invalidData = {
        name: '', // Empty name
      };

      await request(testBase.getHttpServer())
        .patch('/org')
        .set('Authorization', `Bearer ${testContext.owner.token}`)
        .send(invalidData)
        .expect(400);
    });

    it('should require authentication', async () => {
      const updateData = {
        name: testBase.isolation.generateOrgName('unauth'),
      };

      await request(testBase.getHttpServer()).patch('/org').send(updateData).expect(401);
    });
  });

  describe('GET /org/members', () => {
    it('should list organization members for owner', async () => {
      const response = await request(testBase.getHttpServer())
        .get('/org/members')
        .set('Authorization', `Bearer ${testContext.owner.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('members');
      expect(Array.isArray(response.body.members)).toBe(true);
      expect(response.body.members.length).toBeGreaterThanOrEqual(3); // owner, admin, member

      // Verify member structure
      const member = response.body.members[0];
      expect(member).toHaveProperty('id');
      expect(member).toHaveProperty('email');
      expect(member).toHaveProperty('name');
      expect(member).toHaveProperty('role');
      expect(member).toHaveProperty('status');
    });

    it('should list organization members for admin', async () => {
      const response = await request(testBase.getHttpServer())
        .get('/org/members')
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('members');
      expect(Array.isArray(response.body.members)).toBe(true);
    });

    it('should list organization members for member', async () => {
      const response = await request(testBase.getHttpServer())
        .get('/org/members')
        .set('Authorization', `Bearer ${testContext.member.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('members');
      expect(Array.isArray(response.body.members)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(testBase.getHttpServer()).get('/org/members').expect(401);
    });
  });

  describe('POST /org/members/invite', () => {
    it('should invite new member (admin)', async () => {
      const inviteData = {
        email: testBase.isolation.generateEmail('invited'),
        role: OrgRole.member,
      };

      const response = await request(testBase.getHttpServer())
        .post('/org/members/invite')
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .send(inviteData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Invitation sent successfully');
      expect(response.body).toHaveProperty('invitedEmail', inviteData.email);
      expect(response.body).toHaveProperty('inviteToken');

      // Verify user and membership were created
      const invitedUser = await testBase.prisma.user.findUnique({
        where: { email: inviteData.email },
      });
      expect(invitedUser).toBeDefined();

      const membership = await testBase.prisma.orgMember.findFirst({
        where: {
          userId: invitedUser!.id,
          orgId: testContext.org.id,
        },
      });
      expect(membership).toBeDefined();
      expect(membership?.role).toBe('member');
      expect(membership?.status).toBe('invited');
    });

    it('should invite new member (owner)', async () => {
      const inviteData = {
        email: `owner-invite-${Math.random().toString(36).substring(2)}@test.com`,
        role: OrgRole.admin,
      };

      const response = await request(testBase.getHttpServer())
        .post('/org/members/invite')
        .set('Authorization', `Bearer ${testContext.owner.token}`)
        .send(inviteData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Invitation sent successfully');
      expect(response.body).toHaveProperty('invitedEmail', inviteData.email);
    });

    it('should not allow members to invite', async () => {
      const inviteData = {
        email: testBase.isolation.generateEmail('forbidden-invite'),
        role: OrgRole.member,
      };

      await request(testBase.getHttpServer())
        .post('/org/members/invite')
        .set('Authorization', `Bearer ${testContext.member.token}`)
        .send(inviteData)
        .expect(403);
    });

    it('should allow re-inviting same email (upsert behavior)', async () => {
      const inviteData = {
        email: `duplicate-invite-${Math.random().toString(36).substring(2)}@test.com`,
        role: OrgRole.member,
      };

      // First invite
      await request(testBase.getHttpServer())
        .post('/org/members/invite')
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .send(inviteData)
        .expect(201);

      // Re-invitation (should work with upsert)
      await request(testBase.getHttpServer())
        .post('/org/members/invite')
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .send(inviteData)
        .expect(201);
    });

    it('should validate email format', async () => {
      const inviteData = {
        email: 'invalid-email',
        role: OrgRole.member,
      };

      await request(testBase.getHttpServer())
        .post('/org/members/invite')
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .send(inviteData)
        .expect(400);
    });

    it('should validate role', async () => {
      const inviteData = {
        email: testBase.isolation.generateEmail('invalid-role'),
        role: 'invalid_role',
      };

      await request(testBase.getHttpServer())
        .post('/org/members/invite')
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .send(inviteData)
        .expect(400);
    });

    it('should not allow admin to invite owner role', async () => {
      const inviteData = {
        email: testBase.isolation.generateEmail('owner-invite'),
        role: OrgRole.owner,
      };

      await request(testBase.getHttpServer())
        .post('/org/members/invite')
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .send(inviteData)
        .expect(400);
    });
  });

  describe('PATCH /org/members/:memberId', () => {
    let targetMemberId: string;

    beforeEach(async () => {
      // Create a target member to update
      const targetUser = await testBase.factory.createUser({
        email: testBase.isolation.generateEmail('target'),
        orgId: testContext.org.id,
        role: 'member',
      });

      const targetMember = await testBase.prisma.orgMember.findFirst({
        where: {
          userId: targetUser.id,
          orgId: testContext.org.id,
        },
      });
      targetMemberId = targetMember!.userId;
    });

    it('should update member role (owner)', async () => {
      const updateData = {
        role: OrgRole.admin,
      };

      const response = await request(testBase.getHttpServer())
        .patch(`/org/members/${targetMemberId}`)
        .set('Authorization', `Bearer ${testContext.owner.token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.member).toHaveProperty('role', 'admin');

      // Verify in database
      const updatedMember = await testBase.prisma.orgMember.findUnique({
        where: {
          orgId_userId: {
            orgId: testContext.org.id,
            userId: targetMemberId,
          },
        },
      });
      expect(updatedMember?.role).toBe('admin');
    });

    it('should update member role (admin)', async () => {
      const updateData = {
        role: OrgRole.admin,
      };

      const response = await request(testBase.getHttpServer())
        .patch(`/org/members/${targetMemberId}`)
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.member).toHaveProperty('role', 'admin');
    });

    it('should not allow members to update roles', async () => {
      const updateData = {
        role: OrgRole.admin,
      };

      await request(testBase.getHttpServer())
        .patch(`/org/members/${targetMemberId}`)
        .set('Authorization', `Bearer ${testContext.member.token}`)
        .send(updateData)
        .expect(403);
    });

    it('should not allow admin to set owner role', async () => {
      const updateData = {
        role: OrgRole.owner,
      };

      await request(testBase.getHttpServer())
        .patch(`/org/members/${targetMemberId}`)
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .send(updateData)
        .expect(403);
    });

    it('should return 404 for non-existent member', async () => {
      const updateData = {
        role: OrgRole.admin,
      };

      await request(testBase.getHttpServer())
        .patch('/org/members/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${testContext.owner.token}`)
        .send(updateData)
        .expect(404);
    });

    it('should not allow updating member from different org', async () => {
      // Create another org with a member
      const { org: otherOrg } = await testBase.factory.createOrganization({
        ownerEmail: `cross-org-owner-${Math.random().toString(36).substring(2)}@test.com`,
      });
      const otherMember = await testBase.factory.createUser({
        email: `other-org-${Math.random().toString(36).substring(2)}@test.com`,
        orgId: otherOrg.id,
        role: 'member',
      });

      const otherOrgMember = await testBase.prisma.orgMember.findFirst({
        where: {
          userId: otherMember.id,
          orgId: otherOrg.id,
        },
      });

      const updateData = {
        role: OrgRole.admin,
      };

      // Try to update other org's member with current org's admin token
      await request(testBase.getHttpServer())
        .patch(`/org/members/${otherOrgMember!.userId}`)
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /org/members/:memberId', () => {
    let targetMemberId: string;
    // let targetUserId: string; // Unused variable

    beforeEach(async () => {
      // Create a target member to remove
      const targetUser = await testBase.factory.createUser({
        email: testBase.isolation.generateEmail('remove-target'),
        orgId: testContext.org.id,
        role: 'member',
      });

      const targetMember = await testBase.prisma.orgMember.findFirst({
        where: {
          userId: targetUser.id,
          orgId: testContext.org.id,
        },
      });
      targetMemberId = targetMember!.userId;
    });

    it('should remove member (owner)', async () => {
      await request(testBase.getHttpServer())
        .delete(`/org/members/${targetMemberId}`)
        .set('Authorization', `Bearer ${testContext.owner.token}`)
        .expect(204);

      // No body expected for 204 status

      // Verify member was removed
      const removedMember = await testBase.prisma.orgMember.findUnique({
        where: {
          orgId_userId: {
            orgId: testContext.org.id,
            userId: targetMemberId,
          },
        },
      });
      expect(removedMember).toBeNull();
    });

    it('should remove member (admin)', async () => {
      await request(testBase.getHttpServer())
        .delete(`/org/members/${targetMemberId}`)
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .expect(204);

      // No body expected for 204 status
    });

    it('should not allow members to remove other members', async () => {
      await request(testBase.getHttpServer())
        .delete(`/org/members/${targetMemberId}`)
        .set('Authorization', `Bearer ${testContext.member.token}`)
        .expect(403);
    });

    it('should not allow removing the owner', async () => {
      const ownerMember = await testBase.prisma.orgMember.findFirst({
        where: {
          userId: testContext.owner.id,
          orgId: testContext.org.id,
        },
      });

      await request(testBase.getHttpServer())
        .delete(`/org/members/${ownerMember!.userId}`)
        .set('Authorization', `Bearer ${testContext.owner.token}`)
        .expect(403);
    });

    it('should not allow admin to remove owner', async () => {
      const ownerMember = await testBase.prisma.orgMember.findFirst({
        where: {
          userId: testContext.owner.id,
          orgId: testContext.org.id,
        },
      });

      await request(testBase.getHttpServer())
        .delete(`/org/members/${ownerMember!.userId}`)
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .expect(403);
    });

    it('should return 404 for non-existent member', async () => {
      await request(testBase.getHttpServer())
        .delete('/org/members/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${testContext.owner.token}`)
        .expect(404);
    });
  });
});
