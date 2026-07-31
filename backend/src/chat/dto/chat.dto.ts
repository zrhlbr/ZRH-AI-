import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** POST /chat —— 发送消息 / 继续回答（流式） */
export class SendMessageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  conversationId?: number;

  /** mode=send 时必填；continue 模式可为空 */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2097152)
  message?: string;

  /** 聊天中自由切换模型：新消息走新模型，旧消息保留历史 */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  /** 选用角色 Prompt 模板 */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  promptCode?: string;

  /** true = 继续回答（接着上次中断/结尾继续生成） */
  @IsOptional()
  @IsBoolean()
  continue?: boolean;
}

export class ConversationIdDto {
  @Type(() => Number)
  @IsInt()
  conversationId!: number;
}

/** GET /chat/list —— 分页 + 搜索 + 过滤 */
export class ConversationListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  pinned?: number;

  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  favorite?: number;
}

/** GET /chat/:id —— 消息懒加载游标 */
export class MessagesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  /** 只取 id 小于该值的更早消息 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  before?: number;
}

/** PATCH /chat/:id —— 重命名 / 收藏 / 固定 / 分组 / 切模型 */
export class UpdateConversationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  folderId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  promptCode?: string;
}

/** PATCH /chat/messages/:id —— 点赞 / 点踩 */
export class UpdateMessageDto {
  @IsOptional()
  @IsIn(['like', 'dislike', null])
  feedback?: 'like' | 'dislike' | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}

/** PATCH /chat/parameters —— 生成参数（保存数据库） */
export class UpdateParamsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  topP?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(200)
  topK?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  repeatPenalty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(512)
  @Max(131072)
  contextLength?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(16)
  @Max(32768)
  maxTokens?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seed?: number | null;
}
