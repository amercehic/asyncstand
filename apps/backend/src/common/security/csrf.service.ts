import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { CacheService } from '@/common/cache/cache.service';
import { LoggerService } from '@/common/logger.service';

interface CsrfTokenInfo {
  token: string;
  sessionId: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
}

@Injectable()
export class CsrfService {
  private readonly TOKEN_LENGTH = 32;
  private readonly DEFAULT_EXPIRY = 3600; // 1 hour in seconds
  private readonly MAX_TOKENS_PER_SESSION = 5;

  constructor(
    private readonly cacheService: CacheService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(CsrfService.name);
  }

  /**
   * Generate a new CSRF token for a session
   */
  async generateToken(sessionId: string, userId?: string): Promise<string> {
    const tokenData = randomBytes(this.TOKEN_LENGTH).toString('hex');
    const tokenHash = this.hashToken(tokenData);
    const expiresAt = new Date(Date.now() + this.DEFAULT_EXPIRY * 1000);

    const tokenInfo: CsrfTokenInfo = {
      token: tokenData,
      sessionId,
      createdAt: new Date(),
      expiresAt,
      used: false,
    };

    const cacheKey = this.buildTokenKey(tokenHash);
    const sessionKey = this.buildSessionKey(sessionId);

    try {
      // Store token info
      await this.cacheService.set(cacheKey, tokenInfo, this.DEFAULT_EXPIRY);

      // Track tokens per session to prevent abuse
      const sessionTokens = (await this.cacheService.get<string[]>(sessionKey)) || [];
      sessionTokens.push(tokenHash);

      // Limit number of tokens per session
      if (sessionTokens.length > this.MAX_TOKENS_PER_SESSION) {
        const oldestTokenHash = sessionTokens.shift();
        if (oldestTokenHash) {
          await this.cacheService.del(this.buildTokenKey(oldestTokenHash));
        }
      }

      await this.cacheService.set(sessionKey, sessionTokens, this.DEFAULT_EXPIRY);

      this.logger.debug('CSRF token generated', {
        sessionId,
        userId,
        tokenHash: tokenHash.substring(0, 8) + '...',
        expiresAt,
      });

      return tokenData;
    } catch (error) {
      this.logger.error('Error generating CSRF token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        userId,
      });
      throw new Error('Failed to generate CSRF token');
    }
  }

  /**
   * Validate a CSRF token
   */
  async validateToken(
    sessionId: string,
    providedToken: string,
    oneTimeUse = true,
  ): Promise<boolean> {
    if (!sessionId || !providedToken) {
      this.logger.warn('CSRF validation failed: missing parameters', {
        sessionId: !!sessionId,
        token: !!providedToken,
      });
      return false;
    }

    const tokenHash = this.hashToken(providedToken);
    const cacheKey = this.buildTokenKey(tokenHash);

    try {
      const tokenInfo = await this.cacheService.get<CsrfTokenInfo>(cacheKey);

      if (!tokenInfo) {
        this.logger.warn('CSRF validation failed: token not found', {
          sessionId,
          tokenHash: tokenHash.substring(0, 8) + '...',
        });
        return false;
      }

      // Check if token belongs to the correct session
      if (tokenInfo.sessionId !== sessionId) {
        this.logger.warn('CSRF validation failed: session mismatch', {
          expectedSession: sessionId,
          tokenSession: tokenInfo.sessionId,
        });
        return false;
      }

      // Check if token has expired
      if (new Date() > tokenInfo.expiresAt) {
        this.logger.warn('CSRF validation failed: token expired', {
          sessionId,
          expiresAt: tokenInfo.expiresAt,
        });
        await this.cacheService.del(cacheKey);
        return false;
      }

      // Check if token has already been used (for one-time use tokens)
      if (oneTimeUse && tokenInfo.used) {
        this.logger.warn('CSRF validation failed: token already used', {
          sessionId,
          tokenHash: tokenHash.substring(0, 8) + '...',
        });
        return false;
      }

      // Mark token as used if it's a one-time use token
      if (oneTimeUse) {
        tokenInfo.used = true;
        await this.cacheService.set(cacheKey, tokenInfo, this.DEFAULT_EXPIRY);
      }

      this.logger.debug('CSRF token validated successfully', {
        sessionId,
        tokenHash: tokenHash.substring(0, 8) + '...',
        oneTimeUse,
      });

      return true;
    } catch (error) {
      this.logger.error('Error validating CSRF token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
      return false;
    }
  }

  /**
   * Invalidate a specific token
   */
  async invalidateToken(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const cacheKey = this.buildTokenKey(tokenHash);

    try {
      const tokenInfo = await this.cacheService.get<CsrfTokenInfo>(cacheKey);
      if (tokenInfo) {
        await this.cacheService.del(cacheKey);

        // Remove from session tokens list
        const sessionKey = this.buildSessionKey(tokenInfo.sessionId);
        const sessionTokens = (await this.cacheService.get<string[]>(sessionKey)) || [];
        const updatedTokens = sessionTokens.filter((t) => t !== tokenHash);

        if (updatedTokens.length > 0) {
          await this.cacheService.set(sessionKey, updatedTokens, this.DEFAULT_EXPIRY);
        } else {
          await this.cacheService.del(sessionKey);
        }

        this.logger.debug('CSRF token invalidated', {
          sessionId: tokenInfo.sessionId,
          tokenHash: tokenHash.substring(0, 8) + '...',
        });
      }
    } catch (error) {
      this.logger.error('Error invalidating CSRF token', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Invalidate all tokens for a session
   */
  async invalidateSession(sessionId: string): Promise<void> {
    const sessionKey = this.buildSessionKey(sessionId);

    try {
      const sessionTokens = (await this.cacheService.get<string[]>(sessionKey)) || [];

      // Delete all tokens for this session
      const deletePromises = sessionTokens.map((tokenHash) =>
        this.cacheService.del(this.buildTokenKey(tokenHash)),
      );

      await Promise.all([...deletePromises, this.cacheService.del(sessionKey)]);

      this.logger.debug('All CSRF tokens invalidated for session', {
        sessionId,
        tokenCount: sessionTokens.length,
      });
    } catch (error) {
      this.logger.error('Error invalidating session tokens', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
    }
  }

  /**
   * Clean up expired tokens (called periodically)
   */
  async cleanupExpiredTokens(): Promise<{ cleaned: number; errors: number }> {
    const cleaned = 0;
    let errors = 0;

    try {
      // This is a simplified cleanup - in production you'd want to use Redis SCAN
      // to iterate through keys efficiently
      // Implementation would depend on your Redis setup
      // For now, we'll just log that cleanup was attempted

      this.logger.debug('CSRF token cleanup completed', { cleaned, errors });
    } catch (error) {
      this.logger.error('Error during CSRF token cleanup', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      errors++;
    }

    return { cleaned, errors };
  }

  /**
   * Get CSRF protection statistics
   */
  async getStats(): Promise<{
    activeTokens: number;
    activeSessions: number;
    tokensGenerated24h: number;
    tokensValidated24h: number;
    validationFailures24h: number;
  }> {
    // This would require implementing counters for metrics
    // For now, return placeholder data
    return {
      activeTokens: 0,
      activeSessions: 0,
      tokensGenerated24h: 0,
      tokensValidated24h: 0,
      validationFailures24h: 0,
    };
  }

  /**
   * Generate double-submit cookie token (alternative CSRF protection method)
   */
  async generateDoubleSubmitToken(): Promise<{ token: string; signature: string }> {
    const token = randomBytes(this.TOKEN_LENGTH).toString('hex');
    const signature = this.signToken(token);

    return { token, signature };
  }

  /**
   * Validate double-submit cookie token
   */
  validateDoubleSubmitToken(token: string, signature: string): boolean {
    const expectedSignature = this.signToken(token);
    return this.constantTimeCompare(signature, expectedSignature);
  }

  /**
   * Hash a token for storage
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Sign a token with a secret
   */
  private signToken(token: string): string {
    const secret = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production';
    return createHash('hmac-sha256')
      .update(token + secret)
      .digest('hex');
  }

  /**
   * Constant-time comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Build cache key for token storage
   */
  private buildTokenKey(tokenHash: string): string {
    return this.cacheService.buildKey('csrf-token', tokenHash);
  }

  /**
   * Build cache key for session token tracking
   */
  private buildSessionKey(sessionId: string): string {
    return this.cacheService.buildKey('csrf-session', sessionId);
  }
}
