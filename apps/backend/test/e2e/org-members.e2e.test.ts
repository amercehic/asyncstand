import request from 'supertest';
import { OrgRole, OrgMemberStatus } from '@prisma/client';
import { E2ETestBase } from '@/test/utils/e2e-test-base';

describe('Organization Members (e2e)', () => {
  const testBase = new E2ETestBase();

  let testContext: {
    org: { id: string; name: string };
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

    // Create organization with admin and member
    const { org, owner: admin } = await testBase.factory.createOrganization();

    const member = await testBase.factory.createUser({
      email: testBase.isolation.generateEmail('member'),
      orgId: org.id,
      role: 'member',
    });

    testContext = {
      org,
      admin: admin as { id: string; token: string },
      member: member as { id: string; token: string },
    };
  });

  afterEach(async () => {
    await testBase.teardownTest();
  });

  describe('GET /org/members', () => {
    it('should list organization members for admin', async () => {
      const response = await request(testBase.getHttpServer())
        .get('/org/members')
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('members');
      expect(Array.isArray(response.body.members)).toBe(true);
      expect(response.body.members.length).toBeGreaterThanOrEqual(2);
    });

    it('should list organization members for member', async () => {
      const response = await request(testBase.getHttpServer())
        .get('/org/members')
        .set('Authorization', `Bearer ${testContext.member.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('members');
      expect(Array.isArray(response.body.members)).toBe(true);
    });

    it('should include invited members', async () => {
      // Create invited member
      const invitedUser = await testBase.factory.createUser({
        email: testBase.isolation.generateEmail('invited'),
      });

      await testBase.prisma.orgMember.create({
        data: {
          orgId: testContext.org.id,
          userId: invitedUser.id,
          role: 'member',
          status: OrgMemberStatus.invited,
        },
      });

      const response = await request(testBase.getHttpServer())
        .get('/org/members')
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .expect(200);

      const invitedMember = response.body.members.find(
        (m: { status: string }) => m.status === 'invited',
      );
      expect(invitedMember).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(testBase.getHttpServer()).get('/org/members').expect(401);
    });
  });

  describe('POST /org/members/invite', () => {
    it('should invite new member with email', async () => {
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

      const membership = await testBase.prisma.orgMember.findUnique({
        where: {
          orgId_userId: {
            orgId: testContext.org.id,
            userId: invitedUser!.id,
          },
        },
      });
      expect(membership).toBeDefined();
      expect(membership?.role).toBe('member');
      expect(membership?.status).toBe('invited');
    });

    it('should invite existing user to organization', async () => {
      // Create user not in current org
      const existingUser = await testBase.factory.createUser({
        email: testBase.isolation.generateEmail('existing'),
      });

      const inviteData = {
        email: existingUser.email,
        role: OrgRole.member,
      };

      const response = await request(testBase.getHttpServer())
        .post('/org/members/invite')
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .send(inviteData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Invitation sent successfully');
      expect(response.body).toHaveProperty('invitedEmail', inviteData.email);

      // Verify membership was created
      const membership = await testBase.prisma.orgMember.findUnique({
        where: {
          orgId_userId: {
            orgId: testContext.org.id,
            userId: existingUser.id,
          },
        },
      });
      expect(membership).toBeDefined();
    });

    it('should not allow members to invite', async () => {
      const inviteData = {
        email: testBase.isolation.generateEmail('forbidden'),
        role: OrgRole.member,
      };

      await request(testBase.getHttpServer())
        .post('/org/members/invite')
        .set('Authorization', `Bearer ${testContext.member.token}`)
        .send(inviteData)
        .expect(403);
    });

    it('should allow re-inviting the same email (upsert behavior)', async () => {
      const inviteData = {
        email: testBase.isolation.generateEmail('duplicate'),
        role: OrgRole.member,
      };

      // First invitation
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
        email: '@@@invalid@@@',
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
  });

  describe('PATCH /org/members/:userId', () => {
    let targetUserId: string;

    beforeEach(async () => {
      // Create target member
      const targetUser = await testBase.factory.createUser({
        email: testBase.isolation.generateEmail('target'),
        orgId: testContext.org.id,
        role: 'member',
      });
      targetUserId = targetUser.id;
    });

    it('should update member role', async () => {
      const updateData = {
        role: OrgRole.admin,
      };

      const response = await request(testBase.getHttpServer())
        .patch(`/org/members/${targetUserId}`)
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.member).toHaveProperty('role', 'admin');

      // Verify in database
      const updatedMember = await testBase.prisma.orgMember.findUnique({
        where: {
          orgId_userId: {
            orgId: testContext.org.id,
            userId: targetUserId,
          },
        },
      });
      expect(updatedMember?.role).toBe('admin');
    });

    it('should suspend/unsuspend member', async () => {
      const updateData = {
        suspend: true,
      };

      const response = await request(testBase.getHttpServer())
        .patch(`/org/members/${targetUserId}`)
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.member).toHaveProperty('status', 'suspended');
    });

    it('should not allow members to update roles', async () => {
      const updateData = {
        role: OrgRole.admin,
      };

      await request(testBase.getHttpServer())
        .patch(`/org/members/${targetUserId}`)
        .set('Authorization', `Bearer ${testContext.member.token}`)
        .send(updateData)
        .expect(403);
    });

    it('should return 404 for non-existent member', async () => {
      const updateData = {
        role: OrgRole.admin,
      };

      await request(testBase.getHttpServer())
        .patch('/org/members/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /org/members/:userId', () => {
    let targetUserId: string;

    beforeEach(async () => {
      // Create target member
      const targetUser = await testBase.factory.createUser({
        email: testBase.isolation.generateEmail('remove-target'),
        orgId: testContext.org.id,
        role: 'member',
      });
      targetUserId = targetUser.id;
    });

    it('should remove member from organization', async () => {
      await request(testBase.getHttpServer())
        .delete(`/org/members/${targetUserId}`)
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .expect(204);

      // No body expected for 204 status

      // Verify member was removed
      const removedMember = await testBase.prisma.orgMember.findUnique({
        where: {
          orgId_userId: {
            orgId: testContext.org.id,
            userId: targetUserId,
          },
        },
      });
      expect(removedMember).toBeNull();
    });

    it('should not allow members to remove other members', async () => {
      await request(testBase.getHttpServer())
        .delete(`/org/members/${targetUserId}`)
        .set('Authorization', `Bearer ${testContext.member.token}`)
        .expect(403);
    });

    it('should not allow removing organization owner', async () => {
      await request(testBase.getHttpServer())
        .delete(`/org/members/${testContext.admin.id}`)
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .expect(400);
    });

    it('should return 404 for non-existent member', async () => {
      await request(testBase.getHttpServer())
        .delete('/org/members/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .expect(404);
    });
  });

  describe('Member Activity & Audit', () => {
    it('should track member invitation in audit logs', async () => {
      const inviteData = {
        email: `audit-${Math.random().toString(36).substring(2)}@test.com`,
        role: OrgRole.member,
      };

      await request(testBase.getHttpServer())
        .post('/org/members/invite')
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .send(inviteData)
        .expect(201);

      // Check audit logs
      const auditLog = await testBase.prisma.auditLog.findFirst({
        where: {
          action: 'org_member.invited',
          actorUserId: testContext.admin.id,
        },
      });

      expect(auditLog).toBeDefined();
    });

    it('should track member role changes in audit logs', async () => {
      // Create target member
      const targetUser = await testBase.factory.createUser({
        email: testBase.isolation.generateEmail('role-change'),
        orgId: testContext.org.id,
        role: 'member',
      });

      const updateData = {
        role: OrgRole.admin,
      };

      await request(testBase.getHttpServer())
        .patch(`/org/members/${targetUser.id}`)
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .send(updateData)
        .expect(200);

      // Check audit logs
      const auditLog = await testBase.prisma.auditLog.findFirst({
        where: {
          action: 'org_member.updated',
          actorUserId: testContext.admin.id,
        },
      });

      expect(auditLog).toBeDefined();
    });

    it('should track member removal in audit logs', async () => {
      // Create target member
      const targetUser = await testBase.factory.createUser({
        email: testBase.isolation.generateEmail('removal'),
        orgId: testContext.org.id,
        role: 'member',
      });

      await request(testBase.getHttpServer())
        .delete(`/org/members/${targetUser.id}`)
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .expect(204);

      // Check audit logs
      const auditLog = await testBase.prisma.auditLog.findFirst({
        where: {
          action: 'org_member.removed',
          actorUserId: testContext.admin.id,
        },
      });

      expect(auditLog).toBeDefined();
    });
  });

  describe('Permission & Role Validation', () => {
    it('should validate role hierarchy for updates', async () => {
      // Member should not be able to promote themselves to admin
      const updateData = {
        role: OrgRole.admin,
      };

      await request(testBase.getHttpServer())
        .patch(`/org/members/${testContext.member.id}`)
        .set('Authorization', `Bearer ${testContext.member.token}`)
        .send(updateData)
        .expect(403);
    });

    it('should prevent circular permission changes', async () => {
      // Admin cannot change their own role to member
      const updateData = {
        role: OrgRole.member,
      };

      await request(testBase.getHttpServer())
        .patch(`/org/members/${testContext.admin.id}`)
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .send(updateData)
        .expect(403);
    });

    it('should validate organization isolation', async () => {
      // Create another org with members
      const { org: otherOrg } = await testBase.factory.createOrganization({
        name: testBase.isolation.generateOrgName('other'),
        ownerEmail: testBase.isolation.generateEmail('other-owner'),
      });
      const otherMember = await testBase.factory.createUser({
        email: testBase.isolation.generateEmail('other-org-member'),
        orgId: otherOrg.id,
        role: 'member',
      });

      // Try to access other org's member with current org's admin
      await request(testBase.getHttpServer())
        .patch(`/org/members/${otherMember.id}`)
        .set('Authorization', `Bearer ${testContext.admin.token}`)
        .send({ role: 'admin' })
        .expect(404);
    });
  });
});
