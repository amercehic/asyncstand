import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { LoggerService } from '@/common/logger.service';
import { ISessionIdentifier, SessionContext } from '@/common/session/interfaces/session.interface';

interface RequestWithSession extends Request {
  session?: { id: string };
  user?: { id: string };
}

@Injectable()
export class SessionIdentifierService implements ISessionIdentifier {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(SessionIdentifierService.name);
  }

  /**
   * Extract session ID from request with proper fallback hierarchy
   */
  extractSessionId(request: Request): string {
    const req = request as RequestWithSession;

    // 1. Express session (highest priority)
    if (req.session?.id) {
      return req.session.id;
    }

    // 2. Custom session header
    const headerSessionId = request.headers['x-session-id'];
    if (headerSessionId && typeof headerSessionId === 'string') {
      return headerSessionId;
    }

    // 3. User ID as fallback (for JWT-based auth without sessions)
    if (req.user?.id) {
      return `user-session:${req.user.id}`;
    }

    // 4. Request fingerprint as last resort
    return this.generateFallbackSessionId(request);
  }

  /**
   * Generate a fallback session ID based on request fingerprint
   */
  generateFallbackSessionId(request: Request): string {
    const components = [request.ip || 'unknown-ip', request.get('user-agent') || 'unknown-ua'];

    const fingerprint = Buffer.from(components.join('|')).toString('base64');
    return `fingerprint:${fingerprint}`;
  }

  /**
   * Get detailed session context with metadata
   */
  getSessionContext(request: Request): SessionContext {
    const req = request as RequestWithSession;
    let sessionId: string;
    let source: SessionContext['source'];
    let isAuthenticated = false;

    if (req.session?.id) {
      sessionId = req.session.id;
      source = 'express-session';
      isAuthenticated = true;
    } else if (request.headers['x-session-id']) {
      sessionId = request.headers['x-session-id'] as string;
      source = 'header';
      isAuthenticated = !!req.user;
    } else if (req.user?.id) {
      sessionId = `user-session:${req.user.id}`;
      source = 'user-fallback';
      isAuthenticated = true;
    } else {
      sessionId = this.generateFallbackSessionId(request);
      source = 'fingerprint';
      isAuthenticated = false;
    }

    this.logger.debug('Session context extracted', {
      sessionId: sessionId.substring(0, 20) + '...',
      source,
      isAuthenticated,
      userId: req.user?.id,
    });

    return {
      sessionId,
      source,
      isAuthenticated,
      userId: req.user?.id,
    };
  }

  /**
   * Get all possible session IDs for a request (for cleanup purposes)
   */
  getAllSessionIds(request: Request, userId?: string): string[] {
    const req = request as RequestWithSession;
    const sessionIds = new Set<string>();

    // Add express session if exists
    if (req.session?.id) {
      sessionIds.add(req.session.id);
    }

    // Add header session if exists
    const headerSessionId = request.headers['x-session-id'];
    if (headerSessionId && typeof headerSessionId === 'string') {
      sessionIds.add(headerSessionId);
    }

    // Add user-based session ID
    const targetUserId = userId || req.user?.id;
    if (targetUserId) {
      sessionIds.add(`user-session:${targetUserId}`);
    }

    // Add fingerprint session as fallback
    sessionIds.add(this.generateFallbackSessionId(request));

    return Array.from(sessionIds);
  }
}
