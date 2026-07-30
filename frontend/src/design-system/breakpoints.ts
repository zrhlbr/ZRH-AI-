/**
 * ZRH Design System — 响应式断点（与 Tailwind 对齐，手机优先）
 */
export const breakpoints = {
  /** 手机 */
  xs: 0,
  /** 大手机 / 小平板 */
  sm: 640,
  /** 平板 */
  md: 768,
  /** 小桌面 */
  lg: 1024,
  /** 桌面 */
  xl: 1280,
  /** 宽屏 */
  '2xl': 1536,
} as const;

export type ZrhBreakpoint = keyof typeof breakpoints;

/** JS 侧断点判断（matchMedia） */
export function mediaUp(bp: ZrhBreakpoint): string {
  return `(min-width: ${breakpoints[bp]}px)`;
}
