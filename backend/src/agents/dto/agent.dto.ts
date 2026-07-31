import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
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

export class ListAgentsQueryDto {
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateAgentDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(80)
  avatar?: string;

  @IsString()
  @MaxLength(20000)
  systemPrompt!: string;

  @IsOptional()
  @IsIn(['draft', 'active', 'disabled'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  defaultModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  defaultKnowledgeScope?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  roleAccess?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillCodes?: string[];
}

export class UpdateAgentDto {
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
  @MaxLength(80)
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  systemPrompt?: string;

  @IsOptional()
  @IsIn(['draft', 'active', 'disabled'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  defaultModel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  defaultKnowledgeScope?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  roleAccess?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillCodes?: string[];
}

export class AgentChatDto {
  @IsString()
  @MaxLength(8000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  agentCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  conversationId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  modelRef?: string;
}

export class CreateMemoryDto {
  @IsString()
  @MaxLength(20000)
  content!: string;

  @IsOptional()
  @IsIn(['conversation', 'knowledge', 'note'])
  kind?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  key?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  conversationId?: number;
}

export class ListLogsQueryDto {
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
  agentCode?: string;
}
