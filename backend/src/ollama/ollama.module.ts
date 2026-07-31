import { Module } from '@nestjs/common';
import { AIModule } from '../ai/ai.module';
import { OllamaController } from './ollama.controller';
import { OllamaService } from './ollama.service';

@Module({
  imports: [AIModule],
  controllers: [OllamaController],
  providers: [OllamaService],
  exports: [OllamaService],
})
export class OllamaModule {}
