import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RedisService } from '../../redis/redis.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';
import { AuthUser } from './jwt-auth.guard';

/**
 * 基于 Redis 的滑动窗口限流守卫。
 * 读取 @RateLimit 元数据，按 userId 或 IP 计数。
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const identifier = (options.byUser !== false && request.user?.id)
      ? `u:${request.user.id}`
      : `ip:${this.getClientIp(request)}`;
    const key = `ratelimit:${options.keyPrefix ?? 'global'}:${identifier}`;

    const count = await this.redis.increment(key);
    if (count === 1) {
      await this.redis.expire(key, options.windowSeconds);
    }

    if (count > options.maxRequests) {
      throw new HttpException(`rate limit exceeded: ${options.maxRequests} requests per ${options.windowSeconds}s`, 429);
    }
    return true;
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    return request.ip ?? 'unknown';
  }
}
