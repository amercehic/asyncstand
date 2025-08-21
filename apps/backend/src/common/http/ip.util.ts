import type { Request } from 'express';

export function getClientIp(req: Request): string {
  if (!req?.headers) {
    return 'unknown';
  }

  const xff = (req.headers['x-forwarded-for'] as string) || '';
  const firstIp = xff.split(',')[0]?.trim();

  return (
    firstIp ||
    (req.headers['x-real-ip'] as string) ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  ).trim();
}
