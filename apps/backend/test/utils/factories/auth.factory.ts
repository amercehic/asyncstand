import { faker } from '@faker-js/faker';
import { JwtService } from '@nestjs/jwt';

export interface TokenPayload {
  sub: string;
  email?: string;
  orgId: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export class AuthFactory {
  /**
   * Create JWT token payload for testing
   */
  static buildTokenPayload(overrides: Partial<TokenPayload> = {}): TokenPayload {
    return {
      sub: overrides.sub ?? faker.string.uuid(),
      email: overrides.email ?? faker.internet.email(),
      orgId: overrides.orgId ?? faker.string.uuid(),
      iat: overrides.iat ?? Math.floor(Date.now() / 1000),
      exp: overrides.exp ?? Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
    };
  }

  /**
   * Create refresh token payload for testing
   */
  static buildRefreshTokenPayload(
    overrides: Partial<RefreshTokenPayload> = {},
  ): RefreshTokenPayload {
    const userId = overrides.sub ?? faker.string.uuid();
    const timestamp = Date.now();
    const random = Math.random();

    return {
      sub: userId,
      jti: overrides.jti ?? `${userId}-${timestamp}-${random}`,
      iat: overrides.iat ?? Math.floor(Date.now() / 1000),
      exp: overrides.exp ?? Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    };
  }

  /**
   * Generate a JWT token for testing
   */
  static generateJWT(jwtService: JwtService, payload: Partial<TokenPayload> = {}): string {
    const tokenPayload = this.buildTokenPayload(payload);
    return jwtService.sign(tokenPayload);
  }

  /**
   * Generate refresh token for testing
   */
  static generateRefreshToken(
    jwtService: JwtService,
    payload: Partial<RefreshTokenPayload> = {},
  ): string {
    const refreshPayload = this.buildRefreshTokenPayload(payload);
    return jwtService.sign(refreshPayload, { expiresIn: '7d' });
  }

  /**
   * Create Authorization header for API tests
   */
  static createAuthHeader(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Create complete auth tokens response
   */
  static buildTokensResponse(
    overrides: {
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
    } = {},
  ) {
    return {
      accessToken: overrides.accessToken ?? `mock_access_token_${faker.string.alphanumeric(10)}`,
      refreshToken: overrides.refreshToken ?? `mock_refresh_token_${faker.string.alphanumeric(20)}`,
      expiresIn: overrides.expiresIn ?? 900, // 15 minutes
    };
  }

  /**
   * Create login request data
   */
  static buildLoginRequest(
    overrides: {
      email?: string;
      password?: string;
    } = {},
  ) {
    return {
      email: overrides.email ?? faker.internet.email(),
      password: overrides.password ?? 'TestPassword123!',
    };
  }

  /**
   * Create signup request data
   */
  static buildSignupRequest(
    overrides: {
      email?: string;
      password?: string;
      name?: string;
      orgId?: string;
    } = {},
  ) {
    return {
      email: overrides.email ?? faker.internet.email(),
      password: overrides.password ?? 'TestPassword123!',
      name: overrides.name ?? faker.person.fullName(),
      orgId: overrides.orgId,
    };
  }

  /**
   * Create forgot password request data
   */
  static buildForgotPasswordRequest(
    overrides: {
      email?: string;
    } = {},
  ) {
    return {
      email: overrides.email ?? faker.internet.email(),
    };
  }

  /**
   * Create reset password request data
   */
  static buildResetPasswordRequest(
    overrides: {
      token?: string;
      password?: string;
      email?: string;
    } = {},
  ) {
    return {
      token: overrides.token ?? faker.string.alphanumeric(32),
      password: overrides.password ?? 'NewPassword123!',
      email: overrides.email ?? faker.internet.email(),
    };
  }

  /**
   * Create invite member request data
   */
  static buildInviteMemberRequest(
    overrides: {
      email?: string;
      name?: string;
      role?: string;
    } = {},
  ) {
    return {
      email: overrides.email ?? faker.internet.email(),
      name: overrides.name ?? faker.person.fullName(),
      role: overrides.role ?? 'member',
    };
  }

  /**
   * Create accept invite request data
   */
  static buildAcceptInviteRequest(
    overrides: {
      token?: string;
      password?: string;
      name?: string;
    } = {},
  ) {
    return {
      token: overrides.token ?? faker.string.alphanumeric(32),
      password: overrides.password ?? 'NewPassword123!',
      name: overrides.name ?? faker.person.fullName(),
    };
  }

  /**
   * Parse JWT token payload (for testing purposes)
   */
  static parseJWTPayload(token: string): TokenPayload {
    try {
      const base64Payload = token.split('.')[1];
      const payload = Buffer.from(base64Payload, 'base64').toString('utf-8');
      return JSON.parse(payload) as TokenPayload;
    } catch {
      throw new Error('Invalid JWT token format');
    }
  }

  /**
   * Create mock request object for testing
   */
  static buildMockRequest(
    overrides: {
      ip?: string;
      headers?: Record<string, string>;
      user?: unknown;
      cookies?: Record<string, string>;
      protocol?: string;
    } = {},
  ) {
    const headers = overrides.headers ?? {};
    return {
      ip: overrides.ip ?? faker.internet.ip(),
      headers,
      user: overrides.user,
      cookies: overrides.cookies ?? {},
      protocol: overrides.protocol ?? 'http',
      get: jest.fn((headerName: string): string | string[] | undefined => {
        const value = headers[headerName.toLowerCase()];
        return value || undefined;
      }),
      socket: {
        remoteAddress: overrides.ip ?? faker.internet.ip(),
      },
    };
  }
}
