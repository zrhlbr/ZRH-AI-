import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AIModule } from '../ai/ai.module';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [AIModule, RagModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
