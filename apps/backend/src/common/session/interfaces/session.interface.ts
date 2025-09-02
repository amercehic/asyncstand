import { Request } from 'express';

/**
 * Interface for session identification
 */
export interface ISessionIdentifier {
  /**
   * Extract session ID from request
   */
  extractSessionId(request: Request): string;

  /**
   * Generate a fallback session ID when no session exists
   */
  generateFallbackSessionId(request: Request): string;
}

/**
 * Interface for session cleanup operations
 */
export interface ISessionCleaner {
  /**
   * Clean up all session-related data
   */
  cleanupSession(sessionId: string): Promise<void>;

  /**
   * Clean up multiple sessions
   */
  cleanupSessions(sessionIds: string[]): Promise<void>;
}

/**
 * Session context information
 */
export interface SessionContext {
  sessionId: string;
  userId?: string;
  source: 'express-session' | 'header' | 'user-fallback' | 'fingerprint';
  isAuthenticated: boolean;
}

/**
 * Session cleanup result
 */
export interface SessionCleanupResult {
  sessionId: string;
  success: boolean;
  error?: string;
}
