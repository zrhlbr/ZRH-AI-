import { Controller, Get } from '@nestjs/common';
import { HealthService, HealthReport } from './health.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  // 公开接口：容器健康检查与前端状态卡片使用
  @Public()
  @Get()
  async check(): Promise<HealthReport> {
    return this.health.check();
  }
}
