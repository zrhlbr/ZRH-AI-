import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import { SuperAdminService } from '../superadmin/superadmin.service';
import {
  SaveCodePolicyDto,
  SaveSmtpDto,
  TestSendDto,
  UpsertTemplateDto,
} from './dto/mail.dto';
import { MailService } from './mail.service';

@Controller('superadmin/mail')
export class MailController {
  constructor(
    private readonly mail: MailService,
    private readonly superadmin: SuperAdminService,
  ) {}

  private guard(user: AuthUser) {
    this.superadmin.assertSuper(user.role);
  }

  @Get('status')
  @RequirePermissions('api:superadmin:read')
  async status(@CurrentUser() user: AuthUser) {
    this.guard(user);
    const [smtp, codePolicy, runtime] = await Promise.all([
      this.mail.getSmtpPublic(),
      this.mail.getCodePolicy(),
      Promise.resolve(this.mail.statusSummary()),
    ]);
    return { smtp, codePolicy, runtime };
  }

  @Get('smtp')
  @RequirePermissions('api:superadmin:read')
  smtp(@CurrentUser() user: AuthUser) {
    this.guard(user);
    return this.mail.getSmtpPublic();
  }

  @Post('smtp')
  @RequirePermissions('api:superadmin:write')
  saveSmtp(@CurrentUser() user: AuthUser, @Body() dto: SaveSmtpDto) {
    this.guard(user);
    return this.mail.saveSmtp(dto, user.id);
  }

  @Get('code-policy')
  @RequirePermissions('api:superadmin:read')
  codePolicy(@CurrentUser() user: AuthUser) {
    this.guard(user);
    return this.mail.getCodePolicy();
  }

  @Post('code-policy')
  @RequirePermissions('api:superadmin:write')
  saveCodePolicy(@CurrentUser() user: AuthUser, @Body() dto: SaveCodePolicyDto) {
    this.guard(user);
    return this.mail.saveCodePolicy(dto, user.id);
  }

  @Get('templates')
  @RequirePermissions('api:superadmin:read')
  templates(@CurrentUser() user: AuthUser) {
    this.guard(user);
    return this.mail.listTemplates();
  }

  @Post('templates')
  @RequirePermissions('api:superadmin:write')
  upsertTemplate(@CurrentUser() user: AuthUser, @Body() dto: UpsertTemplateDto) {
    this.guard(user);
    return this.mail.upsertTemplate(dto, user.id);
  }

  @Get('logs')
  @RequirePermissions('api:superadmin:read')
  logs(
    @CurrentUser() user: AuthUser,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('status') status?: string,
    @Query('templateType') templateType?: string,
  ) {
    this.guard(user);
    return this.mail.listSendLogs({
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
      status,
      templateType,
    });
  }

  @Post('test-connection')
  @RequirePermissions('api:superadmin:write')
  testConnection(@CurrentUser() user: AuthUser) {
    this.guard(user);
    return this.mail.testConnection(user.id);
  }

  @Post('test-send')
  @RequirePermissions('api:superadmin:write')
  testSend(@CurrentUser() user: AuthUser, @Body() dto: TestSendDto) {
    this.guard(user);
    return this.mail.testSend(dto.to, dto.templateType, dto.locale, user.id);
  }
}
