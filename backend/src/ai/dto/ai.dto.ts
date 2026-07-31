import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ProviderCodeDto {
  @IsString()
  @MaxLength(32)
  providerCode!: string;
}

export class ModelRefDto {
  @IsString()
  @MaxLength(120)
  providerCode!: string;

  @IsString()
  @MaxLength(120)
  name!: string;
}

export class SetDefaultModelDto {
  @IsString()
  @MaxLength(120)
  providerCode!: string;

  @IsString()
  @MaxLength(120)
  name!: string;
}

export class SetModelEnabledDto {
  @IsString()
  @MaxLength(120)
  providerCode!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsBoolean()
  enabled!: boolean;
}

export class RouteDecisionQueryDto {
  @IsString()
  @MaxLength(4000)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  modelRef?: string;
}

export class StreamChatDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  conversationId?: number;

  @IsString()
  @MaxLength(2097152)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  modelRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  promptCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  systemPrompt?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  topP?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(200)
  topK?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(2)
  repeatPenalty?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(512)
  @Max(131072)
  contextLength?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(16)
  @Max(32768)
  maxTokens?: number;

  @IsOptional()
  @Type(() => Number)
  seed?: number | null;
}

export class StopStreamDto {
  @Type(() => Number)
  @IsInt()
  conversationId!: number;
}
