import { JwtService } from '@nestjs/jwt';
import { TestHelpers } from '@/test/utils/test-helpers';

export interface TokenPayload {
  sub: string;
  email?: string;
  orgId: string;
  iat?: number;
  exp?: number;
}

export interface AuthHeaders {
  Authorization: string;
}

export class AuthHelpers {
  /**
   * Generate a JWT token for testing
   */
  static generateJWT(jwtService: JwtService, payload: Partial<TokenPayload>): string {
    const defaultPayload: TokenPayload = {
      sub: payload.sub || TestHelpers.generateRandomString(),
      orgId: payload.orgId || TestHelpers.generateRandomString(),
      email: payload.email || TestHelpers.generateRandomEmail(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
    };

    return jwtService.sign({ ...defaultPayload, ...payload });
  }

  /**
   * Create authorization headers for API requests
   */
  static createAuthHeaders(token: string): AuthHeaders {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Extract token from cookie string
   */
  static extractTokenFromCookie(
    cookieString: string,
    tokenName: string = 'refreshToken',
  ): string | null {
    if (!cookieString) return null;

    const cookies = Array.isArray(cookieString) ? cookieString : [cookieString];
    const targetCookie = cookies.find((cookie) => cookie.startsWith(`${tokenName}=`));

    if (!targetCookie) return null;

    // Extract token value from cookie
    const tokenMatch = targetCookie.match(new RegExp(`${tokenName}=([^;]+)`));
    return tokenMatch ? tokenMatch[1] : null;
  }

  /**
   * Create a complete token set for testing
   */
  static generateTokenSet(
    jwtService: JwtService,
    userId: string,
    orgId: string,
  ): {
    accessToken: string;
    refreshToken: string;
    payload: TokenPayload;
  } {
    const payload: TokenPayload = {
      sub: userId,
      orgId,
      email: TestHelpers.generateRandomEmail(),
    };

    const accessToken = this.generateJWT(jwtService, payload);
    const refreshToken = this.generateJWT(jwtService, {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    });

    return {
      accessToken,
      refreshToken,
      payload,
    };
  }

  /**
   * Create expired token for testing token expiration
   */
  static generateExpiredJWT(jwtService: JwtService, payload: Partial<TokenPayload>): string {
    const expiredPayload: TokenPayload = {
      sub: payload.sub || TestHelpers.generateRandomString(),
      orgId: payload.orgId || TestHelpers.generateRandomString(),
      email: payload.email || TestHelpers.generateRandomEmail(),
      iat: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      exp: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago (expired)
    };

    return jwtService.sign({ ...expiredPayload, ...payload });
  }

  /**
   * Parse JWT token payload without verification (for testing)
   */
  static parseTokenPayload(token: string): Record<string, unknown> {
    try {
      const base64Payload = token.split('.')[1];
      const payload = Buffer.from(base64Payload, 'base64').toString('utf-8');
      return JSON.parse(payload);
    } catch {
      throw new Error('Invalid JWT token format');
    }
  }

  /**
   * Create token with custom claims for testing edge cases
   */
  static generateCustomJWT(jwtService: JwtService, customClaims: Record<string, unknown>): string {
    return jwtService.sign(customClaims);
  }

  /**
   * Generate basic auth header (for testing basic auth endpoints if any)
   */
  static createBasicAuthHeader(username: string, password: string): { Authorization: string } {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    return {
      Authorization: `Basic ${credentials}`,
    };
  }

  /**
   * Create test user credentials
   */
  static createTestCredentials(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      email: TestHelpers.generateRandomEmail(),
      password: 'TestPassword123!',
      name: 'Test User',
      ...overrides,
    };
  }

  /**
   * Simulate IP address for audit logging tests
   */
  static getTestIpAddress(): string {
    return '192.168.1.100';
  }

  /**
   * Create test user agent string
   */
  static getTestUserAgent(): string {
    return 'Test-Agent/1.0 (Testing Environment)';
  }
}
