import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class BusinessInvokeDto {
  @IsString()
  @MaxLength(60)
  systemCode!: string;

  @IsString()
  @MaxLength(60)
  action!: string;

  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;
}

export class ListBusinessLogsQueryDto {
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
  systemCode?: string;
}
