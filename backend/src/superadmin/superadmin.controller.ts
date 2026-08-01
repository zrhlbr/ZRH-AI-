import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import { SuperAdminService } from './superadmin.service';

class ConfigDto {
  @IsString() @MaxLength(120) key!: string;
  @IsString() value!: string;
  @IsOptional() @IsString() group?: string;
  @IsOptional() @IsBoolean() secret?: boolean;
}

@Controller('superadmin')
export class SuperAdminController {
  constructor(private readonly superadmin: SuperAdminService) {}

  private guard(user: AuthUser) {
    this.superadmin.assertSuper(user.role);
  }

  @Get('overview')
  @RequirePermissions('api:superadmin:read')
  overview(@CurrentUser() user: AuthUser) {
    this.guard(user);
    return this.superadmin.overview();
  }

  @Get('configs')
  @RequirePermissions('api:superadmin:read')
  configs(@CurrentUser() user: AuthUser) {
    this.guard(user);
    return this.superadmin.listConfigs();
  }

  @Post('configs')
  @RequirePermissions('api:superadmin:write')
  upsertConfig(@CurrentUser() user: AuthUser, @Body() dto: ConfigDto) {
    this.guard(user);
    return this.superadmin.upsertConfig({ ...dto, updatedBy: user.id });
  }

  @Get('logs')
  @RequirePermissions('api:superadmin:read')
  logs(@CurrentUser() user: AuthUser) {
    this.guard(user);
    return this.superadmin.systemLogsReserved();
  }

  @Get('ops')
  @RequirePermissions('api:superadmin:read')
  ops(@CurrentUser() user: AuthUser) {
    this.guard(user);
    return this.superadmin.backupRestoreReserved();
  }

  @Get('integrations')
  @RequirePermissions('api:superadmin:read')
  integrations(@CurrentUser() user: AuthUser) {
    this.guard(user);
    return this.superadmin.integrationsReserved();
  }
}
