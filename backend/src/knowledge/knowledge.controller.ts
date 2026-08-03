import {
  BadRequestException,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { DocumentService } from './documents/document.service';
import { ParserService } from './parser/parser.service';
import { RetrieverService } from './retriever/retriever.service';
import { KnowledgeHealthService } from './health/knowledge-health.service';
import { KnowledgePermissionService } from './permissions/permission.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import {
  CreateFolderDto,
  UpdateFolderDto,
  ListDocumentsQueryDto,
  UpdateDocumentDto,
  MoveDocumentDto,
  CopyDocumentDto,
  CreateTagDto,
  SearchKnowledgeDto,
  GrantPermissionDto,
} from './dto/knowledge.dto';

/**
 * /api/v1/knowledge/* —— Knowledge Platform 统一入口（阶段 5）
 */
@Controller('knowledge')
export class KnowledgeController {
  constructor(
    private readonly documents: DocumentService,
    private readonly parser: ParserService,
    private readonly retriever: RetrieverService,
    private readonly health: KnowledgeHealthService,
    private readonly permissions: KnowledgePermissionService,
  ) {}

  // ---------- Folders ----------

  @Post('folders')
  @RequirePermissions('api:knowledge:write')
  createFolder(@Body() dto: CreateFolderDto, @CurrentUser() user: AuthUser) {
    return this.documents.createFolder(user.id, dto);
  }

  @Get('folders')
  @RequirePermissions('api:knowledge:read')
  listFolders(@Query('parentId') parentId: string, @CurrentUser() user: AuthUser) {
    const parsed = parentId ? Number(parentId) : undefined;
    return this.documents.listFolders(user.id, parsed);
  }

  @Patch('folders/:id')
  @RequirePermissions('api:knowledge:write')
  updateFolder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFolderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.updateFolder(user.id, id, dto);
  }

  @Delete('folders/:id')
  @RequirePermissions('api:knowledge:delete')
  deleteFolder(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.documents.deleteFolder(user.id, id);
  }

  // ---------- Documents ----------

  @Post('upload')
  @RequirePermissions('api:knowledge:write')
  @RateLimit({ windowSeconds: 60, maxRequests: 40, keyPrefix: 'knowledge:upload' })
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
    @Body() body: { folderId?: string; title?: string; author?: string; source?: string; tags?: string; permission?: string },
  ) {
    if (!file) throw new BadRequestException('file is required');
    const tags = body.tags
      ? body.tags.split(',').map((t) => Number(t.trim())).filter((n) => !Number.isNaN(n))
      : [];
    return this.documents.upload(user.id, file, {
      folderId: body.folderId ? Number(body.folderId) : undefined,
      title: body.title,
      author: body.author,
      source: body.source,
      tags,
      permission: body.permission as any,
    });
  }

  @Get('documents')
  @RequirePermissions('api:knowledge:read')
  listDocuments(@Query() q: ListDocumentsQueryDto, @CurrentUser() user: AuthUser) {
    return this.documents.listDocuments(user.id, q);
  }

  @Get('documents/:id')
  @RequirePermissions('api:knowledge:read')
  getDocument(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.documents.getDocument(user.id, id);
  }

  @Get('documents/:id/preview')
  @RequirePermissions('api:knowledge:read')
  previewDocument(
    @Param('id', ParseIntPipe) id: number,
    @Query('maxLength') maxLength: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.previewDocument(user.id, id, maxLength ? Number(maxLength) : 1000);
  }

  @Get('documents/:id/download')
  @RequirePermissions('api:knowledge:read')
  async downloadDocument(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { buffer, filename, mimeType } = await this.documents.download(user.id, id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  }

  @Patch('documents/:id')
  @RequirePermissions('api:knowledge:write')
  updateDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    const tags = dto.tag ? [dto.tag] : undefined;
    const { tag, ...rest } = dto;
    return this.documents.updateDocument(user.id, id, { ...rest, tags });
  }

  @Post('documents/:id/move')
  @RequirePermissions('api:knowledge:write')
  moveDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MoveDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.moveDocument(user.id, id, dto.folderId ?? null);
  }

  @Post('documents/:id/copy')
  @RequirePermissions('api:knowledge:write')
  copyDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CopyDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.copyDocument(user.id, id, dto.targetFolderId);
  }

  @Delete('documents/:id')
  @RequirePermissions('api:knowledge:delete')
  deleteDocument(
    @Param('id', ParseIntPipe) id: number,
    @Query('permanent') permanent: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.deleteDocument(user.id, id, permanent === 'true');
  }

  @Post('documents/:id/restore')
  @RequirePermissions('api:knowledge:write')
  restoreDocument(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.documents.restoreDocument(user.id, id);
  }

  @Post('documents/:id/parse')
  @RequirePermissions('api:knowledge:admin')
  parseDocument(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.documents.parseAndChunkDocument(user.id, id);
  }

  @Post('documents/:id/reindex')
  @RequirePermissions('api:knowledge:admin')
  reindexDocument(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.documents.reindexDocument(user.id, id);
  }

  // ---------- Tags ----------

  @Post('tags')
  @RequirePermissions('api:knowledge:write')
  createTag(@Body() dto: CreateTagDto) {
    return this.documents.createTag(dto.name, dto.color);
  }

  @Get('tags')
  @RequirePermissions('api:knowledge:read')
  listTags() {
    return this.documents.listTags();
  }

  // ---------- Permissions ----------

  @Post('documents/:id/permissions')
  @RequirePermissions('api:knowledge:admin')
  grantPermission(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GrantPermissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.permissions.grantPermission(id, dto.targetType, dto.targetId, dto.permission, user.id);
  }

  @Delete('documents/:id/permissions')
  @RequirePermissions('api:knowledge:admin')
  revokePermission(
    @Param('id', ParseIntPipe) id: number,
    @Query('targetType') targetType: 'role' | 'user' | 'department',
    @Query('targetId') targetId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.permissions.revokePermission(id, targetType, Number(targetId), user.id);
  }

  // ---------- Search ----------

  @Get('search')
  @RequirePermissions('api:knowledge:read')
  @RateLimit({ windowSeconds: 60, maxRequests: 30, keyPrefix: 'knowledge:search' })
  async search(@Query() q: SearchKnowledgeDto, @CurrentUser() user: AuthUser) {
    const payload = await this.retriever.search({
      query: q.query,
      mode: q.mode ?? 'hybrid',
      topK: q.topK ?? 10,
      userId: user.id,
    });
    return {
      ...payload,
      results: payload.results.map((r) => ({
        chunkId: r.chunkId,
        documentId: r.documentId,
        content: r.content,
        score: r.score,
        source: r.source,
        document: {
          id: r.documentId,
          title: r.title,
          filename: r.filename,
        },
      })),
    };
  }

  // ---------- Health / Status ----------

  @Get('status')
  @RequirePermissions('api:knowledge:read')
  status() {
    return this.health.status();
  }

  @Get('formats')
  @RequirePermissions('api:knowledge:read')
  formats() {
    return this.parser.supportedFormats();
  }
}
