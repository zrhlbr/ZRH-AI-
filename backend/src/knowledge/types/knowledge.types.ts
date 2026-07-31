/**
 * Knowledge Platform 通用类型
 */

export type DocumentStatus = 'pending' | 'parsing' | 'chunked' | 'embedding' | 'indexed' | 'error';

export type PermissionScope = 'public' | 'company' | 'department' | 'private' | 'role';

export type PermissionTargetType = 'role' | 'user' | 'department';

export type PermissionAction = 'read' | 'write' | 'admin';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface DocumentMetadata {
  title?: string;
  author?: string;
  source?: string;
  language?: string;
  pages?: number;
  [key: string]: unknown;
}

export interface ChunkMetadata {
  heading?: string;
  section?: string;
  table?: boolean;
  [key: string]: unknown;
}
