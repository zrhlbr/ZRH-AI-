import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
  permissions: string[];
}

interface JwtPayload {
  sub: number;
  username: string;
  role: string;
  type: 'access';
}

/** 全局 JWT 鉴权守卫：除 @Public() 接口外一律要求有效 Access Token */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('missing access token');
    }
    const token = header.slice(7);

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('invalid or expired access token');
    }
    if (payload.type !== 'access') {
      throw new UnauthorizedException('wrong token type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('user not available');
    }

    request.user = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role.code,
      permissions: user.role.permissions.map((rp) => rp.permission.code),
    };
    return true;
  }
}
