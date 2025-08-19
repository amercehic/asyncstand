import { http, HttpResponse } from 'msw';

export const handlers = [
  // Health
  http.get('*/health', () => HttpResponse.json({ status: 'ok' })),

  // Auth: login (match any host)
  http.post('*/auth/login', async ({ request }) => {
    const body = await request.json();
    const { email, password } = body as { email: string; password: string; rememberMe?: boolean };

    if (email === 'test@example.com' && password === 'password') {
      return HttpResponse.json({
        accessToken: 'mock-access-token',
        expiresIn: 3600,
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'admin',
        },
        organizations: [],
      });
    }

    return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }),

  // Auth: signup
  http.post('*/auth/signup', async ({ request }) => {
    const body = await request.json();
    const { email, name } = body as { email: string; password: string; name: string };

    return HttpResponse.json({ id: '2', email, name }, { status: 201 });
  }),

  // Auth: me
  http.get('*/auth/me', ({ request }) => {
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.includes('Bearer')) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    return HttpResponse.json({ id: '1', email: 'test@example.com', name: 'Test User' });
  }),

  // Auth: logout
  http.post('*/auth/logout', () => {
    return HttpResponse.json({ success: true });
  }),

  // Auth: CSRF token
  http.get('*/auth/csrf-token', () => {
    return HttpResponse.json({ csrfToken: 'mock-csrf-token' });
  }),

  // Teams
  http.get('*/teams', () => {
    return HttpResponse.json([]);
  }),

  http.get('*/teams/:teamId', ({ params }) => {
    const { teamId } = params;
    return HttpResponse.json({
      id: teamId,
      name: 'Sample Team',
      description: 'A sample team for testing',
      members: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }),

  http.post('*/teams', async ({ request }) => {
    const body = await request.json();
    const { name, description } = body as { name: string; description?: string };

    return HttpResponse.json(
      {
        id: '1',
        name,
        description: description || '',
        members: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  // Team Standups
  http.get('*/teams/:teamId/standups', () => {
    return HttpResponse.json([]);
  }),

  http.post('*/teams/:teamId/standups', async ({ request, params }) => {
    const body = await request.json();
    const { teamId } = params;
    const { name, questions, schedule, slackChannelId } = body as {
      name: string;
      questions: string[];
      schedule: {
        time: string;
        days: string[];
        timezone: string;
      };
      slackChannelId?: string;
    };

    return HttpResponse.json(
      {
        id: '1',
        teamId,
        name,
        questions,
        schedule,
        slackChannelId,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  // Standups
  http.get('*/standups/:standupId', ({ params }) => {
    const { standupId } = params;
    return HttpResponse.json({
      id: standupId,
      teamId: '1',
      name: 'Daily Standup',
      questions: [
        'What did you work on yesterday?',
        'What are you working on today?',
        'Any blockers or challenges?',
      ],
      schedule: {
        time: '09:00',
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        timezone: 'UTC',
      },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }),

  http.get('*/standups/:standupId/instances', () => {
    return HttpResponse.json([]);
  }),

  // Instances
  http.get('*/instances/:instanceId', ({ params }) => {
    const { instanceId } = params;
    return HttpResponse.json({
      id: instanceId,
      configId: '1',
      date: new Date().toISOString().split('T')[0],
      status: 'active',
      participants: ['1', '2', '3'],
      responses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }),

  http.post('*/instances/:instanceId/responses', async () => {
    return HttpResponse.json({ success: true, message: 'Response submitted successfully' });
  }),

  http.put('*/instances/:instanceId/responses', async () => {
    return HttpResponse.json({ success: true, message: 'Response updated successfully' });
  }),

  // Integrations
  http.get('*/integrations/slack', () => {
    return HttpResponse.json([]);
  }),

  http.post('*/integrations/slack/connect', async () => {
    return HttpResponse.json(
      {
        id: '1',
        platform: 'slack',
        workspaceName: 'Test Workspace',
        createdAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  http.delete('*/integrations/:integrationId', async () => {
    return HttpResponse.json({ success: true });
  }),
];
