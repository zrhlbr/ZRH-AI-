import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  emailCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  phoneCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  inviteCode?: string;

  @IsBoolean()
  acceptTerms!: boolean;

  @IsBoolean()
  acceptPrivacy!: boolean;

  @IsOptional()
  @IsIn(['zh-CN', 'my-MM', 'en-US'])
  language?: string;
}

export class SendCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  target!: string;

  @IsIn(['email', 'phone'])
  channel!: 'email' | 'phone';

  @IsIn(['register', 'reset', 'bind'])
  purpose!: 'register' | 'reset' | 'bind';
}

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  account!: string; // username | email | phone

  @IsOptional()
  @IsIn(['email', 'phone'])
  channel?: 'email' | 'phone';
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class V12LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  account!: string; // username | email | phone

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;
}
