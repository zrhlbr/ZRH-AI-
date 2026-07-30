import { Controller, Get } from '@nestjs/common';
import { SystemService } from './system.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

/**
 * 统一系统监控接口（阶段 2 基础数据版，阶段 4 扩展为完整监控）。
 * 所有接口需要对应 API 权限。
 */
@Controller('system')
export class SystemController {
  constructor(private readonly system: SystemService) {}

  @Get('cpu')
  @RequirePermissions('api:system:cpu')
  cpu() {
    return this.system.cpu();
  }

  @Get('memory')
  @RequirePermissions('api:system:memory')
  memory() {
    return this.system.memory();
  }

  @Get('gpu')
  @RequirePermissions('api:system:gpu')
  gpu() {
    return this.system.gpu();
  }

  @Get('network')
  @RequirePermissions('api:system:network')
  network() {
    return this.system.network();
  }

  @Get('storage')
  @RequirePermissions('api:system:storage')
  storage() {
    return this.system.storage();
  }

  @Get('docker')
  @RequirePermissions('api:system:docker')
  docker() {
    return this.system.docker();
  }
}
