import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ChatService } from './chat.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import {
  ConversationIdDto,
  ConversationListQueryDto,
  MessagesQueryDto,
  SendMessageDto,
  UpdateConversationDto,
  UpdateMessageDto,
  UpdateParamsDto,
} from './dto/chat.dto';

/**
 * /api/v1/chat —— AI 对话核心接口（阶段 3）
 * POST /chat 与 POST /chat/regenerate 为 SSE 流式接口（@Res 直写），
 * 其余接口走统一返回包装。
 */
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  // ---------- 流式 ----------

  @Post()
  @RequirePermissions('api:chat:write')
  send(
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const mode = dto.continue ? 'continue' : 'send';
    return this.chat.stream(user, dto, mode, req, res);
  }

  @Post('regenerate')
  @RequirePermissions('api:chat:write')
  regenerate(
    @Body() dto: ConversationIdDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.chat.stream(user, { conversationId: dto.conversationId }, 'regenerate', req, res);
  }

  @Post('stop')
  @RequirePermissions('api:chat:write')
  stop(@Body() dto: ConversationIdDto, @CurrentUser() user: AuthUser) {
    return { stopped: this.chat.stopGeneration(user.id, dto.conversationId) };
  }

  // ---------- 对话列表 / 详情 ----------

  @Get('list')
  @RequirePermissions('api:chat:read')
  list(@Query() query: ConversationListQueryDto, @CurrentUser() user: AuthUser) {
    return this.chat.listConversations(user.id, query);
  }

  @Get('stats')
  @RequirePermissions('api:chat:read')
  stats(@CurrentUser() user: AuthUser) {
    return this.chat.stats(user.id);
  }

  // ---------- 模型 / 参数 / Prompt ----------

  @Get('models')
  @RequirePermissions('api:chat:read')
  models() {
    return this.chat.listModels();
  }

  @Get('models/status')
  @RequirePermissions('api:chat:read')
  modelsStatus() {
    return this.chat.modelsStatus();
  }

  @Get('parameters')
  @RequirePermissions('api:chat:read')
  parameters(@CurrentUser() user: AuthUser) {
    return this.chat.getParams(user.id);
  }

  @Patch('parameters')
  @RequirePermissions('api:parameters:write')
  updateParameters(@Body() dto: UpdateParamsDto, @CurrentUser() user: AuthUser) {
    return this.chat.updateParams(user.id, dto);
  }

  @Get('prompts')
  @RequirePermissions('api:prompts:read')
  prompts() {
    return this.chat.listPrompts();
  }

  // ---------- 消息管理 ----------

  @Patch('messages/:id')
  @RequirePermissions('api:chat:write')
  updateMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.chat.updateMessage(user.id, id, dto);
  }

  @Delete('messages/:id')
  @RequirePermissions('api:chat:delete')
  deleteMessage(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.chat.deleteMessage(user.id, id);
  }

  // ---------- 单个对话 ----------

  @Get(':id')
  @RequirePermissions('api:chat:read')
  detail(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: MessagesQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.chat.getConversation(user.id, id, query);
  }

  @Patch(':id')
  @RequirePermissions('api:chat:write')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConversationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.chat.updateConversation(user.id, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('api:chat:delete')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.chat.deleteConversation(user.id, id);
  }

  @Get(':id/export')
  @RequirePermissions('api:chat:read')
  async export(
    @Param('id', ParseIntPipe) id: number,
    @Query('format') format: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const fmt = format === 'json' ? 'json' : 'md';
    const file = await this.chat.exportConversation(user.id, id, fmt);
    res.setHeader('Content-Type', `${file.mime}; charset=utf-8`);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.body);
  }
}
