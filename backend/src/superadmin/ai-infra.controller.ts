import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsBoolean, IsIn, IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import { AIGatewayService } from '../ai/gateway/ai-gateway.service';
import { SuperAdminService } from './superadmin.service';

class HybridModeDto {
  @IsString()
  @IsIn(['AUTO', 'GPU_ONLY', 'CPU_ONLY'])
  mode!: 'AUTO' | 'GPU_ONLY' | 'CPU_ONLY';
}

class HybridNodeDto {
  @IsString()
  @IsIn(['laptop-gpu', 'server-cpu'])
  nodeId!: 'laptop-gpu' | 'server-cpu';

  @IsBoolean()
  enabled!: boolean;
}

/**
 * SUPER_ADMIN — AI Infrastructure / Inference Nodes
 * Internal Tailscale / localhost URLs never exposed via USER APIs.
 */
@Controller('superadmin/ai')
export class AiInfraController {
  constructor(
    private readonly superadmin: SuperAdminService,
    private readonly gateway: AIGatewayService,
  ) {}

  private guard(user: AuthUser) {
    this.superadmin.assertSuper(user.role);
  }

  @Get('inference')
  @RequirePermissions('api:superadmin:read')
  inference(@CurrentUser() user: AuthUser) {
    this.guard(user);
    return this.gateway.getHybridSnapshot(true);
  }

  @Post('inference/mode')
  @RequirePermissions('api:superadmin:write')
  setMode(@CurrentUser() user: AuthUser, @Body() dto: HybridModeDto) {
    this.guard(user);
    return this.gateway.setHybridRoutingMode(dto.mode);
  }

  @Post('inference/node')
  @RequirePermissions('api:superadmin:write')
  setNode(@CurrentUser() user: AuthUser, @Body() dto: HybridNodeDto) {
    this.guard(user);
    return this.gateway.setHybridNodeEnabled(dto.nodeId, dto.enabled);
  }
}
