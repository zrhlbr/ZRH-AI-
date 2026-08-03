import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import { AdminService } from './admin.service';

class AnnouncementDto {
  @IsOptional() id?: number;
  @IsString() @MaxLength(200) title!: string;
  @IsString() body!: string;
  @IsOptional() @IsString() locale?: string;
  @IsOptional() @IsBoolean() published?: boolean;
}

class StatusDto {
  @IsIn(['active', 'disabled']) status!: 'active' | 'disabled';
}

class RoleDto {
  @IsString() roleCode!: string;
}

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  @RequirePermissions('api:admin:read')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('users')
  @RequirePermissions('api:users:read')
  users(@Query('q') q?: string) {
    return this.admin.listUsers(q);
  }

  @Patch('users/:id/status')
  @RequirePermissions('api:users:admin')
  setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admin.setUserStatus(id, dto.status, { id: user.id, role: user.role });
  }

  @Patch('users/:id/role')
  @RequirePermissions('api:users:admin')
  setRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admin.setUserRole(id, dto.roleCode, { id: user.id, role: user.role });
  }

  @Get('roles')
  @RequirePermissions('api:roles:read')
  roles() {
    return this.admin.listRoles();
  }

  @Get('permissions')
  @RequirePermissions('api:roles:read')
  permissions() {
    return this.admin.listPermissions();
  }

  @Get('announcements')
  @RequirePermissions('api:admin:read')
  announcements() {
    return this.admin.listAnnouncements();
  }

  @Post('announcements')
  @RequirePermissions('api:admin:write')
  upsertAnnouncement(@CurrentUser() user: AuthUser, @Body() dto: AnnouncementDto) {
    return this.admin.upsertAnnouncement({ ...dto, createdBy: user.id });
  }
}
