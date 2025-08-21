import { SetMetadata } from '@nestjs/common';
import { AuditCategory, AuditSeverity } from '@/common/audit/types';

export const AUDIT_META_KEY = 'audit:event';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResourceExtractor = (data: any) => Array<{ type: string; id?: string; action?: string }>;

export interface AuditMeta {
  action: string;
  resources?: Array<{ type: string; id?: string; action?: string }>;
  category?: AuditCategory;
  severity?: AuditSeverity;
  resourcesFromResult?: ResourceExtractor;
  resourcesFromRequest?: ResourceExtractor;
  redactRequestBodyPaths?: string[];
  captureResponse?: boolean;
  captureRequest?: boolean;
}

export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_META_KEY, meta);
