import { Controller, Get, Res, Logger, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ZeroFlickerFlagsService, type Flags } from '@/features/zero-flicker.service';
import { readFileSync } from 'fs';
import { join } from 'path';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { CurrentOrg } from '@/auth/decorators/current-org.decorator';

@Controller()
export class AppWithFlagsController {
  private readonly logger = new Logger(AppWithFlagsController.name);
  private indexHtmlTemplate: string;

  constructor(private readonly flagsService: ZeroFlickerFlagsService) {
    this.loadIndexTemplate();
  }

  /**
   * Serve index.html with injected feature flags for authenticated users
   */
  @Get('/')
  @UseGuards(JwtAuthGuard)
  async serveIndexAuthenticated(
    @CurrentUser('userId') userId: string,
    @CurrentOrg() orgId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      // Get feature flags for this user/org
      const { flags } = await this.flagsService.getFlagsForUser(userId, orgId);

      // Inject flags into HTML
      const html = this.injectFlags(this.indexHtmlTemplate, flags);

      this.sendHtmlResponse(res, html);
    } catch (error) {
      this.logger.error('Failed to serve authenticated index with flags:', error);

      // Fallback: serve template with empty flags
      const html = this.injectFlags(this.indexHtmlTemplate, {});
      this.sendHtmlResponse(res, html);
    }
  }

  /**
   * Serve index.html for unauthenticated users (login/signup pages)
   */
  @Get(['/', '/login', '/signup', '/auth/*'])
  async serveIndexUnauthenticated(@Res() res: Response): Promise<void> {
    try {
      // For unauthenticated users, inject minimal safe flags
      const flags: Flags = {
        // Core features that don't require authentication
        public_api: true,
        auth_enabled: true,
      };

      const html = this.injectFlags(this.indexHtmlTemplate, flags);
      this.sendHtmlResponse(res, html);
    } catch (error) {
      this.logger.error('Failed to serve unauthenticated index:', error);

      // Fallback: serve template with empty flags
      const html = this.injectFlags(this.indexHtmlTemplate, {});
      this.sendHtmlResponse(res, html);
    }
  }

  /**
   * Load index.html template on startup
   */
  private loadIndexTemplate(): void {
    try {
      const indexPath = join(process.cwd(), 'apps', 'frontend', 'dist', 'index.html');
      this.indexHtmlTemplate = readFileSync(indexPath, 'utf-8');
      this.logger.log('Loaded index.html template from frontend dist');
    } catch (error) {
      this.logger.error('Failed to load index.html template:', error);
      // Fallback template for development
      this.indexHtmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AsyncStand</title>
  <link rel="preconnect" href="${process.env.FRONTEND_URL || 'http://localhost:5173'}">
  <!--__FLAGS__-->
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/index.js"></script>
</body>
</html>`.trim();
    }
  }

  /**
   * Inject feature flags into HTML template
   */
  private injectFlags(template: string, flags: Flags): string {
    const flagsJson = JSON.stringify(flags);
    // Escape < to prevent breaking out of script tag
    const escapedJson = flagsJson.replace(/</g, '\\u003c');

    const flagsScript = `<script id="__FLAGS__" type="application/json">${escapedJson}</script>`;

    return template.replace('<!--__FLAGS__-->', flagsScript);
  }

  /**
   * Send HTML response with security headers
   */
  private sendHtmlResponse(res: Response, html: string): void {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    res.send(html);
  }

  /**
   * Health check endpoint that includes flags cache stats
   */
  @Get('/health-with-flags')
  healthCheck(): {
    status: string;
    timestamp: string;
    flags_cache: { size: number; keys: string[] };
  } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      flags_cache: this.flagsService.getCacheStats(),
    };
  }
}
