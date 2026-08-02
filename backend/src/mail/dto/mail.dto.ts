import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MAIL_LOCALES, MAIL_TEMPLATE_TYPES } from '../mail.constants';

export class SaveSmtpDto {
  /** Empty host disables SMTP (unconfigured). */
  @IsString() @MaxLength(255) host!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) port!: number;
  @IsOptional() @IsString() @MaxLength(255) username?: string;
  /** Plain password, or ******** to keep existing */
  @IsOptional() @IsString() @MaxLength(512) password?: string;
  @IsIn(['none', 'ssl', 'tls', 'starttls']) encryption!: string;
  /** Empty allowed to disable; non-empty must look like an email */
  @IsString()
  @MaxLength(255)
  @Matches(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'fromEmail must be empty or a valid email' })
  fromEmail!: string;
  @IsOptional() @IsString() @MaxLength(120) fromName?: string;
  @IsOptional()
  @ValidateIf((o: SaveSmtpDto) => !!(o.replyTo && String(o.replyTo).trim()))
  @IsEmail()
  replyTo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1000) @Max(120000) connectionTimeoutMs?: number;
}

export class SaveCodePolicyDto {
  @Type(() => Number) @IsInt() @Min(4) @Max(10) length!: number;
  @Type(() => Number) @IsInt() @Min(60) @Max(3600) ttlSeconds!: number;
  @Type(() => Number) @IsInt() @Min(10) @Max(3600) intervalSeconds!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) dailyLimit!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(10) maxRetries!: number;
}

export class UpsertTemplateDto {
  @IsIn([...MAIL_TEMPLATE_TYPES]) type!: string;
  @IsIn([...MAIL_LOCALES]) locale!: string;
  @IsString() @MaxLength(300) subject!: string;
  @IsString() htmlBody!: string;
  @IsString() textBody!: string;
  @IsOptional() @IsString() variables?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class TestSendDto {
  @IsEmail() to!: string;
  @IsOptional() @IsIn([...MAIL_TEMPLATE_TYPES]) templateType?: string;
  @IsOptional() @IsIn([...MAIL_LOCALES]) locale?: string;
}

export class SendTemplatedMailDto {
  @IsEmail() to!: string;
  @IsIn([...MAIL_TEMPLATE_TYPES]) templateType!: string;
  @IsOptional() @IsIn([...MAIL_LOCALES]) locale?: string;
  @IsOptional() @IsObject() vars?: Record<string, string>;
  @IsOptional() @IsInt() userId?: number;
  @IsOptional() @IsString() requestIp?: string;
}
