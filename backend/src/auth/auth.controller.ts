import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { V12AuthService } from './v12-auth.service';
import { AdminResetPasswordDto, LoginDto, RefreshDto } from './dto/auth.dto';
import {
  ForgotPasswordDto,
  RegisterDto,
  ResetPasswordDto,
  SendCodeDto,
  V12LoginDto,
} from './dto/v12-auth.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AuthUser } from '../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly v12: V12AuthService,
  ) {}

  private meta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    // V1.1 兼容 username；V1.2 可用 account（邮箱/手机/用户名）+ rememberMe
    if (dto.account) {
      return this.v12.loginV12(
        {
          account: dto.account,
          password: dto.password,
          rememberMe: dto.rememberMe,
        } as V12LoginDto,
        this.meta(req),
      );
    }
    return this.auth.login(dto.username!, dto.password, this.meta(req));
  }

  @Public()
  @Post('login/v12')
  @HttpCode(200)
  loginV12(@Body() dto: V12LoginDto, @Req() req: Request) {
    return this.v12.loginV12(dto, this.meta(req));
  }

  @Public()
  @Post('register')
  @HttpCode(200)
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.v12.register(dto, this.meta(req));
  }

  @Public()
  @Post('send-code')
  @HttpCode(200)
  sendCode(@Body() dto: SendCodeDto) {
    return this.v12.sendCode(dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.v12.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.v12.resetPassword(dto);
  }

  @Post('admin/reset-password/:userId')
  @RequirePermissions('api:users:admin')
  adminResetPassword(
    @CurrentUser() user: AuthUser,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: AdminResetPasswordDto,
  ) {
    return this.v12.adminResetPassword(user.id, userId, dto.newPassword);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, this.meta(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Get('profile')
  @RequirePermissions('api:auth:profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.auth.profile(user.id);
  }
}
