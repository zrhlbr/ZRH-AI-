import { Controller, Get } from '@nestjs/common';
import { OllamaService } from './ollama.service';

@Controller('ollama')
export class OllamaController {
  constructor(private readonly ollama: OllamaService) {}

  @Get('health')
  async health() {
    return this.ollama.getStatus();
  }

  @Get('models')
  async models() {
    return this.ollama.listModels();
  }
}
