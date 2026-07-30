import { HTMLAttributes } from 'react';

type Tone = 'accent' | 'ok' | 'warn' | 'err' | 'dim';

export interface ZBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

const toneClass: Record<Tone, string> = {
  accent: 'border-zrh-accent/40 text-zrh-accent',
  ok: 'border-zrh-ok/40 text-zrh-ok',
  warn: 'border-zrh-warn/40 text-zrh-warn',
  err: 'border-zrh-err/40 text-zrh-err',
  dim: 'border-zrh-border text-zrh-text-dim',
};

const dotClass: Record<Tone, string> = {
  accent: 'bg-zrh-accent',
  ok: 'bg-zrh-ok',
  warn: 'bg-zrh-warn',
  err: 'bg-zrh-err',
  dim: 'bg-zrh-text-dim',
};

/** ZRH Badge — 统一状态徽标 */
export function ZBadge({ tone = 'dim', dot, className = '', children, ...rest }: ZBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClass[tone]} ${className}`}
      {...rest}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotClass[tone]}`} />}
      {children}
    </span>
  );
}
