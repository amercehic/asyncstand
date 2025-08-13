import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithMagicToken } from '@/standups/guards/magic-token.guard';
import { MagicTokenPayload } from '@/standups/services/magic-token.service';

/**
 * Parameter decorator to extract the validated magic token payload from the request
 *
 * This decorator should only be used on endpoints protected by MagicTokenGuard
 *
 * @example
 * ```typescript
 * @Get('info')
 * @UseGuards(MagicTokenGuard)
 * async getStandupInfo(@MagicToken() tokenPayload: MagicTokenPayload) {
 *   return this.service.getStandupInfo(tokenPayload);
 * }
 * ```
 */
export const MagicToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MagicTokenPayload => {
    const request = ctx.switchToHttp().getRequest<RequestWithMagicToken>();

    if (!request.magicTokenPayload) {
      throw new Error(
        'Magic token payload not found. Ensure MagicTokenGuard is applied to this endpoint.',
      );
    }

    return request.magicTokenPayload;
  },
);
