import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock API endpoints
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok' });
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json();
    const { email, password } = body as { email: string; password: string };

    // Mock authentication logic
    if (email === 'test@example.com' && password === 'password') {
      return HttpResponse.json({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
        },
        token: 'mock-jwt-token',
      });
    }

    return new HttpResponse(null, { status: 401 });
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const body = await request.json();
    const { email, name } = body as {
      email: string;
      password: string;
      name: string;
    };

    // Mock registration logic
    return HttpResponse.json({
      user: {
        id: '2',
        email,
        name,
      },
      token: 'mock-jwt-token',
    });
  }),

  http.get('/api/auth/me', ({ request }) => {
    const authorization = request.headers.get('authorization');

    if (!authorization || !authorization.includes('Bearer')) {
      return new HttpResponse(null, { status: 401 });
    }

    return HttpResponse.json({
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
    });
  }),
];
