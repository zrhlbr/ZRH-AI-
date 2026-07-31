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

export class ListMcpQueryDto {
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateMcpServerDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsIn(['stub', 'stdio', 'http', 'sse'])
  transport?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  endpoint?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  roleAccess?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class ConnectMcpDto {
  @IsString()
  @MaxLength(60)
  serverCode!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class DisconnectMcpDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sessionId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  serverCode?: string;
}

export class ListMcpLogsQueryDto {
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
  serverCode?: string;
}
