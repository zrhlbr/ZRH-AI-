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

export class ListToolsQueryDto {
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  category?: string;
}

export class CreateToolDto {
  @IsString()
  @MaxLength(60)
  code!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @MaxLength(60)
  categoryCode!: string;

  @IsString()
  @MaxLength(80)
  executorCode!: string;

  @IsOptional()
  @IsObject()
  inputSchema?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  outputSchema?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(500)
  timeoutMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxRetries?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  roleAccess?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateToolDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  categoryCode?: string;

  @IsOptional()
  @IsObject()
  inputSchema?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  outputSchema?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(500)
  timeoutMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxRetries?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  roleAccess?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class ExecuteToolDto {
  @IsString()
  @MaxLength(60)
  toolCode!: string;

  @IsOptional()
  @IsObject()
  args?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['sync', 'async', 'streaming'])
  mode?: 'sync' | 'async' | 'streaming';

  @IsOptional()
  @IsString()
  @MaxLength(60)
  agentCode?: string;
}

export class ToolCallDto {
  @IsString()
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  agentCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  toolCode?: string;

  @IsOptional()
  @IsObject()
  args?: Record<string, unknown>;
}

export class RouteToolDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  task?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  agentCode?: string;
}

export class ListToolLogsQueryDto {
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
  toolCode?: string;
}
