import { Controller, Get } from '@nestjs/common';
import { OllamaService } from './ollama.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@Controller('ollama')
export class OllamaController {
  constructor(private readonly ollama: OllamaService) {}

  @Get('health')
  @RequirePermissions('api:ollama:read')
  async health() {
    return this.ollama.getStatus();
  }

  @Get('models')
  @RequirePermissions('api:ollama:read')
  async models() {
    return this.ollama.listModels();
  }
}
