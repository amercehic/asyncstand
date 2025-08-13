import { ExecutionContext } from '@nestjs/common';
import { RequestWithMagicToken } from '@/standups/guards/magic-token.guard';
import { MagicTokenPayload } from '@/standups/services/magic-token.service';

// Test the decorator callback function directly
const magicTokenCallback = (_data: unknown, ctx: ExecutionContext): MagicTokenPayload => {
  const request = ctx.switchToHttp().getRequest<RequestWithMagicToken>();

  if (!request.magicTokenPayload) {
    throw new Error(
      'Magic token payload not found. Ensure MagicTokenGuard is applied to this endpoint.',
    );
  }

  return request.magicTokenPayload;
};

describe('MagicToken Decorator', () => {
  const mockTokenPayload: MagicTokenPayload = {
    standupInstanceId: 'instance-123',
    teamMemberId: 'member-123',
    platformUserId: 'platform-user-123',
    orgId: 'org-123',
  };

  const createMockExecutionContext = (
    request: Partial<RequestWithMagicToken>,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request as RequestWithMagicToken,
      }),
    } as ExecutionContext;
  };

  it('should extract magic token payload from request', () => {
    const mockRequest: Partial<RequestWithMagicToken> = {
      magicTokenPayload: mockTokenPayload,
    };

    const context = createMockExecutionContext(mockRequest);

    const result = magicTokenCallback(undefined, context);

    expect(result).toEqual(mockTokenPayload);
  });

  it('should throw error when magic token payload is missing', () => {
    const mockRequest: Partial<RequestWithMagicToken> = {
      // magicTokenPayload is undefined
    };

    const context = createMockExecutionContext(mockRequest);

    expect(() => magicTokenCallback(undefined, context)).toThrow(
      'Magic token payload not found. Ensure MagicTokenGuard is applied to this endpoint.',
    );
  });

  it('should throw error when magic token payload is null', () => {
    const mockRequest: Partial<RequestWithMagicToken> = {
      magicTokenPayload: null as unknown as MagicTokenPayload,
    };

    const context = createMockExecutionContext(mockRequest);

    expect(() => magicTokenCallback(undefined, context)).toThrow(
      'Magic token payload not found. Ensure MagicTokenGuard is applied to this endpoint.',
    );
  });

  it('should work with all token payload fields', () => {
    const fullTokenPayload: MagicTokenPayload = {
      standupInstanceId: 'instance-456',
      teamMemberId: 'member-456',
      platformUserId: 'slack-user-456',
      orgId: 'org-456',
      iat: 1234567890,
      exp: 1234571490,
    };

    const mockRequest: Partial<RequestWithMagicToken> = {
      magicTokenPayload: fullTokenPayload,
    };

    const context = createMockExecutionContext(mockRequest);

    const result = magicTokenCallback(undefined, context);

    expect(result).toEqual(fullTokenPayload);
    expect(result.iat).toBe(1234567890);
    expect(result.exp).toBe(1234571490);
  });
});
