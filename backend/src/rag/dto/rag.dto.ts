import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RagAskDto {
  @IsString()
  @MaxLength(4000)
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  conversationId?: number;

  @IsOptional()
  @IsIn(['keyword', 'semantic', 'hybrid'])
  mode?: 'keyword' | 'semantic' | 'hybrid';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  modelRef?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  topK?: number;
}

export class RagSearchDto {
  @IsString()
  @MaxLength(4000)
  query!: string;

  @IsOptional()
  @IsIn(['keyword', 'semantic', 'hybrid'])
  mode?: 'keyword' | 'semantic' | 'hybrid';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  topK?: number;

  @IsOptional()
  @Type(() => Number)
  minScore?: number;
}
