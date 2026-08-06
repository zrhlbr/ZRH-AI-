import {
  Body,
  Controller,
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
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import { WorkspaceService } from './workspace.service';
import { CodeIndexService } from './code-index.service';
import { PlanService } from './plan.service';
import { DiffService } from './diff.service';
import { TerminalService } from './terminal.service';
import { GitWriteService } from './git-write.service';
import { DeveloperOrchestrator } from './orchestrator.service';
import { DevSkillsService } from './skills.service';
import { DevAuditService } from './audit.service';
import { RunnerClientService } from './runner-client.service';

class CreateWorkspaceDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() kind?: 'bind' | 'git';
  @IsOptional() @IsString() rootPath?: string;
  @IsOptional() @IsString() remoteUrl?: string;
  @IsOptional() @IsString() description?: string;
}

class ChatDto {
  @IsString() message!: string;
  @IsOptional() @IsBoolean() planMode?: boolean;
}

class TerminalDto {
  @IsString() command!: string;
  @IsOptional() @IsString() cwd?: string;
  @IsOptional() allowDangerous?: boolean;
}

class CommitDto {
  @IsString() message!: string;
  @IsOptional() @IsBoolean() confirmed?: boolean;
}

class DangerousGitDto {
  @IsString() op!: 'reset-hard' | 'clean' | 'push-force';
  @IsBoolean() confirmed!: boolean;
}

class DiffCreateDto {
  @IsOptional() planId?: number;
  @IsString() title!: string;
  files!: Array<{ path: string; changeType: 'create' | 'modify' | 'delete'; patch: string; content?: string }>;
}

@Controller('developer')
export class DeveloperController {
  constructor(
    private readonly workspaces: WorkspaceService,
    private readonly index: CodeIndexService,
    private readonly plans: PlanService,
    private readonly diffs: DiffService,
    private readonly terminal: TerminalService,
    private readonly gitWrite: GitWriteService,
    private readonly orch: DeveloperOrchestrator,
    private readonly skills: DevSkillsService,
    private readonly audit: DevAuditService,
    private readonly runner: RunnerClientService,
  ) {}

  private reqCtx(req: Request) {
    return {
      ip: req.ip,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    };
  }

  @Get('health')
  @RequirePermissions('api:developer:read')
  async health() {
    try {
      const runner = await this.runner.health();
      return { ok: true, runner };
    } catch (e) {
      return { ok: false, runner: { status: 'offline', error: e instanceof Error ? e.message : String(e) } };
    }
  }

  @Get('workspaces')
  @RequirePermissions('api:developer:read')
  listWorkspaces(@CurrentUser() user: AuthUser) {
    return this.workspaces.list(user.id, user.role);
  }

  @Post('workspaces')
  @RequirePermissions('api:developer:admin')
  createWorkspace(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.create(user.id, dto);
  }

  @Get('workspaces/:id')
  @RequirePermissions('api:developer:read')
  getWorkspace(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.workspaces.get(id, user.id, user.role);
  }

  @Post('workspaces/:id/sync')
  @RequirePermissions('api:developer:write')
  sync(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.workspaces.sync(id, user.id, user.role);
  }

  @Get('workspaces/:id/tree')
  @RequirePermissions('api:developer:read')
  tree(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.workspaces.tree(id, user.id, user.role);
  }

  @Get('workspaces/:id/file')
  @RequirePermissions('api:developer:read')
  file(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('path') filePath: string,
  ) {
    return this.workspaces.readFile(id, user.id, user.role, filePath);
  }

  @Get('workspaces/:id/git/:op')
  @RequirePermissions('api:developer:read')
  gitRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('op') op: string,
  ) {
    return this.workspaces.gitRead(id, user.id, user.role, op);
  }

  @Post('workspaces/:id/search/files')
  @RequirePermissions('api:developer:read')
  searchFiles(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { query: string },
  ) {
    return this.index.searchFiles(id, user.id, user.role, body.query || '');
  }

  @Post('workspaces/:id/search/symbols')
  @RequirePermissions('api:developer:read')
  searchSymbols(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { query: string },
  ) {
    return this.index.searchSymbols(id, user.id, user.role, body.query || '');
  }

  @Post('workspaces/:id/search/refs')
  @RequirePermissions('api:developer:read')
  searchRefs(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { query: string },
  ) {
    return this.index.searchRefs(id, user.id, user.role, body.query || '');
  }

  @Post('workspaces/:id/search/semantic')
  @RequirePermissions('api:developer:read')
  searchSemantic(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { query: string },
  ) {
    return this.index.searchSemantic(id, user.id, user.role, body.query || '');
  }

  @Post('workspaces/:id/index/rebuild')
  @RequirePermissions('api:developer:write')
  rebuild(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.index.rebuild(id, user.id, user.role);
  }

  @Post('sessions')
  @RequirePermissions('api:developer:chat')
  createSession(
    @CurrentUser() user: AuthUser,
    @Body() body: { workspaceId: number; title?: string; skillCode?: string; modelRef?: string },
  ) {
    return this.orch.createSession({
      workspaceId: body.workspaceId,
      userId: user.id,
      roleCode: user.role,
      title: body.title,
      skillCode: body.skillCode,
      modelRef: body.modelRef,
    });
  }

  @Post('sessions/:id/chat')
  @RequirePermissions('api:developer:chat')
  chat(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChatDto,
    @Res() res: Response,
  ) {
    return this.orch.chat({
      sessionId: id,
      userId: user.id,
      roleCode: user.role,
      message: dto.message,
      planMode: dto.planMode,
      res,
    });
  }

  @Get('plans')
  @RequirePermissions('api:developer:read')
  listPlans(@CurrentUser() user: AuthUser, @Query('workspaceId', ParseIntPipe) workspaceId: number) {
    return this.plans.list(workspaceId, user.id, user.role);
  }

  @Get('plans/:id')
  @RequirePermissions('api:developer:read')
  getPlan(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.plans.get(id, user.id, user.role);
  }

  @Post('plans/:id/approve')
  @RequirePermissions('api:developer:write')
  async approvePlan(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    const plan = await this.plans.approve(id, user.id, user.role);
    const diff = await this.orch.materializeDiffFromPlan(id, user.id, user.role);
    return { plan, diff };
  }

  @Post('plans/:id/reject')
  @RequirePermissions('api:developer:write')
  rejectPlan(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.plans.reject(id, user.id, user.role);
  }

  @Post('diffs')
  @RequirePermissions('api:developer:write')
  createDiff(@CurrentUser() user: AuthUser, @Body() dto: DiffCreateDto & { workspaceId: number }) {
    return this.diffs.create({
      workspaceId: dto.workspaceId,
      planId: dto.planId,
      userId: user.id,
      roleCode: user.role,
      title: dto.title,
      files: dto.files,
    });
  }

  @Get('diffs/:id')
  @RequirePermissions('api:developer:read')
  getDiff(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.diffs.get(id, user.id, user.role);
  }

  @Post('diffs/:id/approve')
  @RequirePermissions('api:developer:write')
  approveDiff(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.diffs.approve(id, user.id, user.role);
  }

  @Post('diffs/:id/reject')
  @RequirePermissions('api:developer:write')
  rejectDiff(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.diffs.reject(id, user.id, user.role);
  }

  @Post('diffs/:id/apply')
  @RequirePermissions('api:developer:write')
  applyDiff(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.diffs.apply(id, user.id, user.role, this.reqCtx(req));
  }

  @Post('diffs/:id/rollback')
  @RequirePermissions('api:developer:write')
  rollbackDiff(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.diffs.rollback(id, user.id, user.role, this.reqCtx(req));
  }

  @Post('diffs/:id/files/:fileId/confirm-delete')
  @RequirePermissions('api:developer:write')
  confirmDelete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('fileId', ParseIntPipe) fileId: number,
  ) {
    return this.diffs.confirmDelete(id, fileId, user.id, user.role);
  }

  @Post('workspaces/:id/terminal')
  @RequirePermissions('api:developer:terminal')
  runTerminal(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TerminalDto,
    @Req() req: Request,
  ) {
    return this.terminal.run({
      workspaceId: id,
      userId: user.id,
      roleCode: user.role,
      command: dto.command,
      cwd: dto.cwd,
      allowDangerous: dto.allowDangerous,
      ctx: this.reqCtx(req),
    });
  }

  @Post('workspaces/:id/git/commit')
  @RequirePermissions('api:developer:write')
  commit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CommitDto,
    @Req() req: Request,
  ) {
    return this.gitWrite.commit(id, user.id, user.role, dto.message, dto.confirmed === true, this.reqCtx(req));
  }

  @Post('workspaces/:id/git/revert')
  @RequirePermissions('api:developer:write')
  revert(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { sha: string },
  ) {
    return this.gitWrite.revert(id, user.id, user.role, body.sha);
  }

  @Post('workspaces/:id/git/dangerous')
  @RequirePermissions('api:developer:admin')
  dangerous(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DangerousGitDto,
    @Req() req: Request,
  ) {
    return this.gitWrite.dangerous(id, user.id, user.role, dto.op, dto.confirmed, this.reqCtx(req));
  }

  @Get('skills')
  @RequirePermissions('api:developer:read')
  listSkills() {
    return this.skills.list();
  }

  @Get('audit')
  @RequirePermissions('api:developer:read')
  listAudit(
    @CurrentUser() user: AuthUser,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    return this.audit.list(user.id, workspaceId ? Number(workspaceId) : undefined, isAdmin);
  }
}
