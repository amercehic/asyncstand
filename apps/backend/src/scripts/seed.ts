/* eslint-disable no-console, no-restricted-syntax */
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    memoryCost: 1 << 14, // 16 MiB
    timeCost: 3,
  });
}

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Create initial user with specific credentials
  console.log('👤 Creating initial user...');
  const passwordHash = await hashPassword('Premier123!');

  const user = await prisma.user.upsert({
    where: { email: 'user@asyncstand.com' },
    update: {},
    create: {
      email: 'user@asyncstand.com',
      passwordHash,
      name: 'AsyncStand Admin',
    },
  });
  console.log(`✅ User created: ${user.email}`);

  // 2. Create organization
  console.log('🏢 Creating organization...');
  const org = await prisma.organization.create({
    data: {
      name: 'AsyncStand Company',
    },
  });
  console.log(`✅ Organization created: ${org.name}`);

  // 3. Add user as owner of organization
  console.log('🔗 Adding user to organization...');
  await prisma.orgMember.upsert({
    where: { orgId_userId: { orgId: org.id, userId: user.id } },
    update: {},
    create: {
      orgId: org.id,
      userId: user.id,
      role: 'owner',
      status: 'active',
      acceptedAt: new Date(),
    },
  });
  console.log('✅ User added as organization owner');

  // 4. Create Slack integration
  console.log('💬 Creating Slack integration...');
  const integration = await prisma.integration.create({
    data: {
      orgId: org.id,
      platform: 'slack',
      externalTeamId: 'T1234ASYNCSTAND',
      accessToken: 'xoxb-mock-bot-token-for-development',
      botToken: 'xoxb-mock-bot-token-for-development',
      botUserId: 'U0ASYNCSTANDBOT',
      appId: 'A01ASYNCSTAND',
      tokenStatus: 'ok',
      scopes: ['channels:read', 'chat:write', 'users:read', 'groups:read'],
      userScopes: [],
      installedByUserId: user.id,
    },
  });
  console.log('✅ Slack integration created');

  // 5. Create integration sync state
  await prisma.integrationSyncState.upsert({
    where: { integrationId: integration.id },
    update: {},
    create: {
      integrationId: integration.id,
      lastUsersSyncAt: new Date(),
      lastChannelsSyncAt: new Date(),
    },
  });

  // 6. Create Slack channels
  console.log('📺 Creating Slack channels...');
  const channels = [
    {
      channelId: 'C01GENERAL',
      name: 'general',
      topic: 'General discussions and company updates',
      purpose: 'Company-wide communication',
      isPrivate: false,
      memberCount: 25,
    },
    {
      channelId: 'C01ENGINEERING',
      name: 'engineering',
      topic: 'Engineering team discussions and standups',
      purpose: 'Engineering team coordination',
      isPrivate: false,
      memberCount: 8,
    },
    {
      channelId: 'C01DESIGN',
      name: 'design',
      topic: 'Design team collaboration',
      purpose: 'Design team coordination',
      isPrivate: false,
      memberCount: 4,
    },
    {
      channelId: 'C01PRODUCT',
      name: 'product',
      topic: 'Product management and strategy',
      purpose: 'Product team coordination',
      isPrivate: false,
      memberCount: 6,
    },
  ];

  const createdChannels = [];
  for (const channelData of channels) {
    const channel = await prisma.channel.create({
      data: {
        integrationId: integration.id,
        channelId: channelData.channelId,
        name: channelData.name,
        topic: channelData.topic,
        purpose: channelData.purpose,
        isPrivate: channelData.isPrivate,
        memberCount: channelData.memberCount,
        lastSyncAt: new Date(),
      },
    });
    createdChannels.push(channel);
  }
  console.log(`✅ Created ${channels.length} channels`);

  // 7. Create integration users (Slack users)
  console.log('👥 Creating integration users...');
  const integrationUsers = [
    {
      externalUserId: 'U01ADMIN',
      name: 'AsyncStand Admin',
      displayName: 'Admin',
      email: 'user@asyncstand.com',
      timezone: 'America/New_York',
      profileImage: 'https://avatars.slack-edge.com/admin.jpg',
    },
    {
      externalUserId: 'U01JOHN',
      name: 'John Smith',
      displayName: 'John',
      email: 'john.smith@asyncstand.com',
      timezone: 'America/New_York',
      profileImage: 'https://avatars.slack-edge.com/john.jpg',
    },
    {
      externalUserId: 'U01SARAH',
      name: 'Sarah Johnson',
      displayName: 'Sarah',
      email: 'sarah.johnson@asyncstand.com',
      timezone: 'America/Los_Angeles',
      profileImage: 'https://avatars.slack-edge.com/sarah.jpg',
    },
    {
      externalUserId: 'U01MIKE',
      name: 'Mike Chen',
      displayName: 'Mike',
      email: 'mike.chen@asyncstand.com',
      timezone: 'America/New_York',
      profileImage: 'https://avatars.slack-edge.com/mike.jpg',
    },
    {
      externalUserId: 'U01EMILY',
      name: 'Emily Davis',
      displayName: 'Emily',
      email: 'emily.davis@asyncstand.com',
      timezone: 'Europe/London',
      profileImage: 'https://avatars.slack-edge.com/emily.jpg',
    },
    {
      externalUserId: 'U01ALEX',
      name: 'Alex Rodriguez',
      displayName: 'Alex',
      email: 'alex.rodriguez@asyncstand.com',
      timezone: 'America/Los_Angeles',
      profileImage: 'https://avatars.slack-edge.com/alex.jpg',
    },
  ];

  const createdIntegrationUsers = [];
  for (const userData of integrationUsers) {
    const integrationUser = await prisma.integrationUser.create({
      data: {
        integrationId: integration.id,
        externalUserId: userData.externalUserId,
        name: userData.name,
        displayName: userData.displayName,
        email: userData.email,
        timezone: userData.timezone,
        profileImage: userData.profileImage,
        lastSyncAt: new Date(),
      },
    });
    createdIntegrationUsers.push(integrationUser);
  }
  console.log(`✅ Created ${integrationUsers.length} integration users`);

  // 8. Create teams
  console.log('🏗️ Creating teams...');
  const teams = [
    {
      name: 'Engineering Team',
      timezone: 'America/New_York',
    },
    {
      name: 'Design Team',
      timezone: 'America/Los_Angeles',
    },
    {
      name: 'Product Team',
      timezone: 'America/New_York',
    },
  ];

  const createdTeams = [];
  for (const teamData of teams) {
    const team = await prisma.team.upsert({
      where: { orgId_name: { orgId: org.id, name: teamData.name } },
      update: {},
      create: {
        orgId: org.id,
        integrationId: integration.id,
        name: teamData.name,
        timezone: teamData.timezone,
        createdByUserId: user.id,
      },
    });
    createdTeams.push(team);
  }
  console.log(`✅ Created ${teams.length} teams`);

  // 9. Create team members
  console.log('👨‍💼 Adding team members...');

  // Get team and integration user references by name for easier mapping
  const engineeringTeam = createdTeams.find((t) => t.name === 'Engineering Team');
  const designTeam = createdTeams.find((t) => t.name === 'Design Team');
  const productTeam = createdTeams.find((t) => t.name === 'Product Team');

  // Get integration users by name for reference
  const adminIntUser = createdIntegrationUsers.find((u) => u.name === 'AsyncStand Admin');
  const johnIntUser = createdIntegrationUsers.find((u) => u.name === 'John Smith');
  const mikeIntUser = createdIntegrationUsers.find((u) => u.name === 'Mike Chen');
  const emilyIntUser = createdIntegrationUsers.find((u) => u.name === 'Emily Davis');
  const sarahIntUser = createdIntegrationUsers.find((u) => u.name === 'Sarah Johnson');
  const alexIntUser = createdIntegrationUsers.find((u) => u.name === 'Alex Rodriguez');

  const teamMemberships = [
    // Engineering Team
    {
      teamId: engineeringTeam.id,
      integrationUserId: adminIntUser.id,
      userId: user.id,
      name: 'AsyncStand Admin',
    },
    { teamId: engineeringTeam.id, integrationUserId: johnIntUser.id, name: 'John Smith' },
    { teamId: engineeringTeam.id, integrationUserId: mikeIntUser.id, name: 'Mike Chen' },
    { teamId: engineeringTeam.id, integrationUserId: emilyIntUser.id, name: 'Emily Davis' },

    // Design Team
    { teamId: designTeam.id, integrationUserId: sarahIntUser.id, name: 'Sarah Johnson' },
    { teamId: designTeam.id, integrationUserId: alexIntUser.id, name: 'Alex Rodriguez' },

    // Product Team
    {
      teamId: productTeam.id,
      integrationUserId: adminIntUser.id,
      userId: user.id,
      name: 'AsyncStand Admin',
    },
    { teamId: productTeam.id, integrationUserId: emilyIntUser.id, name: 'Emily Davis' },
  ];

  const createdMembers = [];
  for (const membership of teamMemberships) {
    const member = await prisma.teamMember.create({
      data: {
        teamId: membership.teamId,
        integrationUserId: membership.integrationUserId,
        userId: membership.userId || null,
        name: membership.name,
        active: true,
        addedByUserId: user.id,
      },
    });
    createdMembers.push(member);
  }
  console.log(`✅ Added ${teamMemberships.length} team members`);

  // 10. Create standup configurations
  console.log('⏰ Creating standup configurations...');

  // Get channel references by name for easier mapping
  const engineeringChannel = createdChannels.find((c) => c.name === 'engineering');
  const designChannel = createdChannels.find((c) => c.name === 'design');
  const productChannel = createdChannels.find((c) => c.name === 'product');

  const standupConfigs = [
    {
      teamId: engineeringTeam.id,
      name: 'Daily Engineering Standup',
      targetChannelId: engineeringChannel.id,
      questions: [
        'What did you work on yesterday?',
        'What are you working on today?',
        'Any blockers or impediments?',
      ],
      weekdays: [1, 2, 3, 4, 5], // Monday to Friday
      timeLocal: '09:00',
      timezone: 'America/New_York',
      reminderMinutesBefore: 10,
      responseTimeoutHours: 2,
    },
    {
      teamId: designTeam.id,
      name: 'Design Team Check-in',
      targetChannelId: designChannel.id,
      questions: [
        'What design work did you complete yesterday?',
        'What are you designing today?',
        'Any design challenges or feedback needed?',
      ],
      weekdays: [1, 2, 3, 4, 5],
      timeLocal: '10:00',
      timezone: 'America/Los_Angeles',
      reminderMinutesBefore: 15,
      responseTimeoutHours: 3,
    },
    {
      teamId: productTeam.id,
      name: 'Weekly Product Sync',
      targetChannelId: productChannel.id,
      questions: [
        'What product metrics did we hit this week?',
        'What are the key product priorities for next week?',
        'Any product decisions or feedback needed?',
      ],
      weekdays: [1], // Monday only
      timeLocal: '14:00',
      timezone: 'America/New_York',
      reminderMinutesBefore: 30,
      responseTimeoutHours: 4,
    },
  ];

  const createdConfigs = [];
  for (const configData of standupConfigs) {
    const config = await prisma.standupConfig.create({
      data: {
        teamId: configData.teamId,
        name: configData.name,
        deliveryType: 'channel',
        targetChannelId: configData.targetChannelId,
        questions: configData.questions,
        weekdays: configData.weekdays,
        timeLocal: configData.timeLocal,
        timezone: configData.timezone,
        reminderMinutesBefore: configData.reminderMinutesBefore,
        responseTimeoutHours: configData.responseTimeoutHours,
        isActive: true,
        createdByUserId: user.id,
      },
    });
    createdConfigs.push(config);
  }
  console.log(`✅ Created ${standupConfigs.length} standup configurations`);

  // 11. Add members to standup configurations
  console.log('📋 Configuring standup participation...');

  // Map each config to its team for participation
  for (const config of createdConfigs) {
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId: config.teamId },
    });

    for (const member of teamMembers) {
      await prisma.standupConfigMember.create({
        data: {
          standupConfigId: config.id,
          teamMemberId: member.id,
          include: true,
          role: member.userId === user.id ? 'lead' : 'member',
        },
      });
    }
  }
  console.log('✅ Configured standup participation');

  // 12. Create sample standup instances
  console.log('📅 Creating sample standup instances...');
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const today = new Date(now);
  today.setHours(9, 0, 0, 0);

  const instances = [
    {
      teamId: engineeringTeam.id,
      targetDate: yesterday,
      state: 'posted' as const,
      configSnapshot: {
        name: 'Daily Engineering Standup',
        questions: [
          'What did you work on yesterday?',
          'What are you working on today?',
          'Any blockers or impediments?',
        ],
        participatingMembers: createdMembers
          .filter((m) => m.teamId === engineeringTeam.id)
          .map((m) => ({ id: m.id, name: m.name })),
        deliveryType: 'channel',
        targetChannelId: engineeringChannel.id,
        reminderMinutesBefore: 10,
        responseTimeoutHours: 2,
      },
    },
    {
      teamId: engineeringTeam.id,
      targetDate: today,
      state: 'collecting' as const,
      configSnapshot: {
        name: 'Daily Engineering Standup',
        questions: [
          'What did you work on yesterday?',
          'What are you working on today?',
          'Any blockers or impediments?',
        ],
        participatingMembers: createdMembers
          .filter((m) => m.teamId === engineeringTeam.id)
          .map((m) => ({ id: m.id, name: m.name })),
        deliveryType: 'channel',
        targetChannelId: engineeringChannel.id,
        reminderMinutesBefore: 10,
        responseTimeoutHours: 2,
      },
    },
  ];

  const createdInstances = [];
  for (const instanceData of instances) {
    const instance = await prisma.standupInstance.create({
      data: {
        teamId: instanceData.teamId,
        configSnapshot: instanceData.configSnapshot,
        targetDate: instanceData.targetDate,
        state: instanceData.state,
        reminderMessageTs:
          instanceData.state === 'collecting' || instanceData.state === 'posted'
            ? '1234567890.123456'
            : null,
        summaryMessageTs: instanceData.state === 'posted' ? '1234567890.234567' : null,
      },
    });
    createdInstances.push(instance);
  }
  console.log(`✅ Created ${instances.length} standup instances`);

  // 13. Create sample answers for yesterday's standup
  console.log('💬 Creating sample standup answers...');
  const yesterdayInstance = createdInstances.find((i) => i.state === 'posted');
  if (yesterdayInstance) {
    const engineeringMembers = createdMembers.filter((m) => m.teamId === engineeringTeam.id);

    const sampleAnswers = [
      {
        memberId: engineeringMembers.find((m) => m.name === 'AsyncStand Admin')?.id,
        answers: [
          'Reviewed PRs and worked on the audit system refactoring',
          'Finishing the IP address cleanup and starting work on the seed script',
          'None at the moment',
        ],
      },
      {
        memberId: engineeringMembers.find((m) => m.name === 'John Smith')?.id,
        answers: [
          'Implemented user authentication improvements',
          'Working on the team management features',
          'Waiting for design mockups for the new UI',
        ],
      },
      {
        memberId: engineeringMembers.find((m) => m.name === 'Mike Chen')?.id,
        answers: [
          'Fixed database performance issues and optimized queries',
          'Setting up monitoring and alerting systems',
          'Need access to production metrics dashboard',
        ],
      },
    ];

    for (const memberAnswers of sampleAnswers) {
      if (memberAnswers.memberId) {
        for (let questionIndex = 0; questionIndex < memberAnswers.answers.length; questionIndex++) {
          await prisma.answer.create({
            data: {
              standupInstanceId: yesterdayInstance.id,
              teamMemberId: memberAnswers.memberId,
              questionIndex,
              text: memberAnswers.answers[questionIndex],
              submittedAt: new Date(yesterday.getTime() + Math.random() * 2 * 60 * 60 * 1000), // Random time within 2 hours
            },
          });
        }
      }
    }
  }
  console.log('✅ Created sample standup answers');

  // 14. Create some partial answers for today's standup
  console.log('⏳ Creating partial answers for today...');
  const todayInstance = createdInstances.find((i) => i.state === 'collecting');
  if (todayInstance) {
    const adminMember = createdMembers.find(
      (m) => m.name === 'AsyncStand Admin' && m.teamId === engineeringTeam.id,
    );
    if (adminMember) {
      // Only answer first question to show partial completion
      await prisma.answer.create({
        data: {
          standupInstanceId: todayInstance.id,
          teamMemberId: adminMember.id,
          questionIndex: 0,
          text: 'Completed the comprehensive seed script for the AsyncStand database!',
          submittedAt: new Date(),
        },
      });
    }
  }
  console.log('✅ Created partial answers for today');

  // 15. Create sample digest post for yesterday
  console.log('📊 Creating sample digest post...');
  const yesterdayInstanceForDigest = createdInstances.find((i) => i.state === 'posted');
  if (yesterdayInstanceForDigest) {
    await prisma.standupDigestPost.create({
      data: {
        standupInstanceId: yesterdayInstanceForDigest.id,
        integrationId: integration.id,
        channelId: 'C01ENGINEERING',
        messageTs: '1234567890.234567',
      },
    });
  }
  console.log('✅ Created sample digest post');

  // 16. Create participation snapshot
  console.log('📈 Creating participation snapshot...');
  const yesterdayInstanceForSnapshot = createdInstances.find((i) => i.state === 'posted');
  if (yesterdayInstanceForSnapshot) {
    await prisma.participationSnapshot.create({
      data: {
        standupInstanceId: yesterdayInstanceForSnapshot.id,
        answersCount: 3, // 3 people answered
        membersMissing: 1, // 1 person didn't answer
      },
    });
  }
  console.log('✅ Created participation snapshot');

  console.log('\n🎉 Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`• Initial user: user@asyncstand.com (password: Premier123!)`);
  console.log(`• Organization: AsyncStand Company`);
  console.log(`• Slack integration with ${channels.length} channels`);
  console.log(`• ${integrationUsers.length} integration users`);
  console.log(`• ${teams.length} teams with ${teamMemberships.length} team members`);
  console.log(`• ${standupConfigs.length} standup configurations`);
  console.log(`• ${instances.length} standup instances (1 completed, 1 in progress)`);
  console.log(`• Sample answers and digest post created`);
  console.log('\n🚀 Your AsyncStand system is ready for testing!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
