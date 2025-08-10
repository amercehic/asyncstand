import { http, HttpResponse } from 'msw';

export const handlers = [
  // Health
  http.get('*/health', () => HttpResponse.json({ status: 'ok' })),

  // Auth: login (match any host)
  http.post('*/auth/login', async ({ request }) => {
    const body = await request.json();
    const { email, password } = body as { email: string; password: string };

    if (email === 'test@example.com' && password === 'password') {
      return HttpResponse.json({
        accessToken: 'mock-access-token',
        expiresIn: 3600,
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
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
];
