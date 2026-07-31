import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  /** 时间窗口（秒） */
  windowSeconds: number;
  /** 窗口内最大请求数 */
  maxRequests: number;
  /** 按用户 ID 限流；false 则按 IP */
  byUser?: boolean;
  /** 自定义 key 前缀 */
  keyPrefix?: string;
}

export const RATE_LIMIT_KEY = 'rateLimit';

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
