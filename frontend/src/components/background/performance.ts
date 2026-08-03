/**
 * AI Cosmos V3.0 — performance helpers (GPU-light, mobile degrade).
 * No business logic.
 */

export const COSMOS = {
  deep: '#020617',
  slate: '#0F172A',
  indigo: '#1E3A8A',
  blue: '#2563EB',
  soft: '#3B82F6',
  light: '#60A5FA',
  mist: '#DBEAFE',
  white: '#FFFFFF',
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

export function isTabletViewport(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches;
}

/** Cap DPR；手机更低以保 FPS */
export function canvasDpr(): number {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.devicePixelRatio || 1, isMobileViewport() ? 1.25 : 1.75);
}

/** 手机粒子数量约为桌面的 60% */
export function particleBudget(desktopCount: number): number {
  return isMobileViewport() ? Math.max(24, Math.round(desktopCount * 0.6)) : desktopCount;
}
