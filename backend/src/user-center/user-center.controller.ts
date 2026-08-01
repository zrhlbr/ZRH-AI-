import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import { UserCenterService } from './user-center.service';

class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(64) displayName?: string;
  @IsOptional() @IsString() @MaxLength(64) nickname?: string;
  @IsOptional() @IsString() @MaxLength(500) avatarUrl?: string;
  @IsOptional() @IsString() @MaxLength(64) country?: string;
  @IsOptional() @IsString() @MaxLength(16) language?: string;
  @IsOptional() @IsString() @MaxLength(500) bio?: string;
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
}

class ChangePasswordDto {
  @IsString() @MinLength(1) currentPassword!: string;
  @IsString() @MinLength(8) @MaxLength(128) newPassword!: string;
}

@Controller('user-center')
export class UserCenterController {
  constructor(private readonly users: UserCenterService) {}

  @Get('me')
  @RequirePermissions('api:user-center:read')
  me(@CurrentUser() user: AuthUser) {
    return this.users.getMe(user.id);
  }

  @Patch('me')
  @RequirePermissions('api:user-center:write')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Post('change-password')
  @RequirePermissions('api:user-center:write')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Get('login-history')
  @RequirePermissions('api:user-center:read')
  loginHistory(@CurrentUser() user: AuthUser) {
    return this.users.loginHistory(user.id);
  }

  @Get('devices')
  @RequirePermissions('api:user-center:read')
  devices(@CurrentUser() user: AuthUser) {
    return this.users.devices(user.id);
  }

  @Post('devices/:deviceId/revoke')
  @RequirePermissions('api:user-center:write')
  revokeDevice(@CurrentUser() user: AuthUser, @Param('deviceId') deviceId: string) {
    return this.users.revokeDevice(user.id, deviceId);
  }

  @Get('sessions')
  @RequirePermissions('api:user-center:read')
  sessions(@CurrentUser() user: AuthUser) {
    return this.users.sessions(user.id);
  }

  @Get('notifications')
  @RequirePermissions('api:user-center:read')
  notifications(@CurrentUser() user: AuthUser) {
    return this.users.notifications(user.id);
  }

  @Get('api-tokens')
  @RequirePermissions('api:user-center:read')
  apiTokens() {
    return this.users.apiTokensReserved();
  }
}
