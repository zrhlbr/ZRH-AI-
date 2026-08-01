import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
  /** V1.1：用户名 */
  @ValidateIf((o: LoginDto) => !o.account)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username?: string;

  /** V1.2：用户名 / 邮箱 / 手机号 */
  @ValidateIf((o: LoginDto) => !o.username)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  account?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class AdminResetPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
