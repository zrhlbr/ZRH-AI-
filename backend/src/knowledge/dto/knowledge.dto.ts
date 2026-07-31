import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return undefined;
}

export type PermissionScopeDto = 'public' | 'company' | 'department' | 'private' | 'role';

export class CreateFolderDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentId?: number;

  @IsOptional()
  @IsIn(['public', 'company', 'department', 'private', 'role'])
  permission?: PermissionScopeDto;
}

export class UpdateFolderDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentId?: number | null;

  @IsOptional()
  @IsIn(['public', 'company', 'department', 'private', 'role'])
  permission?: PermissionScopeDto;
}

export class ListDocumentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  folderId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  favorite?: boolean;

  /** 仅列出当前用户回收站文档 */
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  trash?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  folderId?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tag?: number; // 单个操作，后续扩展

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @IsOptional()
  @IsIn(['public', 'company', 'department', 'private', 'role'])
  permission?: PermissionScopeDto;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  source?: string;
}

export class MoveDocumentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  folderId?: number | null;
}

export class CopyDocumentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  targetFolderId?: number;
}

export class CreateTagDto {
  @IsString()
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;
}

export class SearchKnowledgeDto {
  @IsString()
  @MaxLength(500)
  query!: string;

  @IsOptional()
  @IsIn(['keyword', 'semantic', 'hybrid'])
  mode?: 'keyword' | 'semantic' | 'hybrid';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  topK?: number;
}

export class GrantPermissionDto {
  @IsIn(['role', 'user', 'department'])
  targetType!: 'role' | 'user' | 'department';

  @Type(() => Number)
  @IsInt()
  targetId!: number;

  @IsIn(['read', 'write', 'admin'])
  permission!: 'read' | 'write' | 'admin';
}
