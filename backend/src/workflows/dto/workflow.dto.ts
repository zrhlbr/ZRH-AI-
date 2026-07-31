import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
}

export class ListWorkflowsQueryDto {
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  template?: boolean;

  @IsOptional()
  @IsString()
  category?: string;
}

export class CreateWorkflowDto {
  @IsString()
  @MaxLength(80)
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  description?: string;

  @IsString()
  @MaxLength(60)
  categoryCode!: string;

  @IsObject()
  graph!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['draft', 'active', 'disabled'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  roleAccess?: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  timeoutMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxRetries?: number;
}

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  categoryCode?: string;

  @IsOptional()
  @IsObject()
  graph?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['draft', 'active', 'disabled'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  roleAccess?: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  timeoutMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxRetries?: number;
}

export class ExecuteWorkflowDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  code?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workflowId?: number;

  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['sync', 'async', 'queue'])
  mode?: 'sync' | 'async' | 'queue';
}

export class CopyWorkflowDto {
  @IsString()
  @MaxLength(80)
  newCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  newName?: string;
}

export class ImportWorkflowDto {
  @IsObject()
  definition!: Record<string, unknown>;
}

export class CreateScheduleDto {
  @IsString()
  @MaxLength(80)
  workflowCode!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsIn(['once', 'cron', 'interval', 'event_reserved'])
  kind!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  cronExpr?: string;

  @IsOptional()
  @IsInt()
  @Min(30)
  intervalSec?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class ListHistoryQueryDto {
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

  @IsOptional()
  @IsString()
  workflowCode?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class ApprovalDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
