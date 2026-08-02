import {
  ZrhColorTokens,
  blueWhiteColors,
  blueWhiteDarkColors,
  blackGoldColors,
  deepSpaceBlueColors,
  midnightBlackColors,
} from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { radius } from './radius';
import { shadows } from './shadows';
import { motionTokens } from './animations';
import { breakpoints } from './breakpoints';

/**
 * ZRH Design System V2.0 — 主题注册表
 * 默认：蓝白科技风；Dark：蓝科技深色；黑金等为历史/可选。
 */

export type ZrhThemeId =
  | 'blue-white'
  | 'blue-white-dark'
  | 'black-gold'
  | 'deep-space-blue'
  | 'midnight-black';

export interface ZrhTheme {
  id: ZrhThemeId;
  /** i18n key，位于 theme.* 命名空间 */
  labelKey: string;
  /** light | dark — 用于 color-scheme / PWA 状态栏 */
  scheme: 'light' | 'dark';
  colors: ZrhColorTokens;
}

export const themes: Record<ZrhThemeId, ZrhTheme> = {
  'blue-white': {
    id: 'blue-white',
    labelKey: 'theme.blueWhite',
    scheme: 'light',
    colors: blueWhiteColors,
  },
  'blue-white-dark': {
    id: 'blue-white-dark',
    labelKey: 'theme.blueWhiteDark',
    scheme: 'dark',
    colors: blueWhiteDarkColors,
  },
  'black-gold': {
    id: 'black-gold',
    labelKey: 'theme.blackGold',
    scheme: 'dark',
    colors: blackGoldColors,
  },
  'deep-space-blue': {
    id: 'deep-space-blue',
    labelKey: 'theme.deepSpaceBlue',
    scheme: 'dark',
    colors: deepSpaceBlueColors,
  },
  'midnight-black': {
    id: 'midnight-black',
    labelKey: 'theme.midnightBlack',
    scheme: 'dark',
    colors: midnightBlackColors,
  },
};

/** 主题切换器展示顺序：默认 Light → Dark → Legacy */
export const themeOrder: ZrhThemeId[] = [
  'blue-white',
  'blue-white-dark',
  'black-gold',
  'deep-space-blue',
  'midnight-black',
];

export const DEFAULT_THEME: ZrhThemeId = 'blue-white';
/** V2 storage key — fresh default to blue-white for all clients */
export const THEME_STORAGE_KEY = 'zrh-ai-theme-v2';

export function isZrhThemeId(id: unknown): id is ZrhThemeId {
  return typeof id === 'string' && id in themes;
}

/** 品牌常量（品牌资产不做翻译，全球统一） */
export const brand = {
  name: 'ZRH AI',
  logo: 'ZRH AI',
  subtitle: 'ZRH Technology Group',
  groupZh: 'ZRH 科技集团',
  groupEn: 'ZRH TECHNOLOGY GROUP',
  copyright: '© ZRH Technology Group',
  iconVersion: 'ZRH AI Official Icon V1.0',
  designSystem: 'ZRH Design System V2.0',
  /** Product release shown in landing / release-notes / footer */
  appVersion: '1.2.1',
} as const;

/** 官方图标资产路径 */
export const brandAssets = {
  iconSvg: '/brand/zrh-ai-icon.svg',
  icon32: '/brand/zrh-ai-icon-32.png',
  icon48: '/brand/zrh-ai-icon-48.png',
  icon64: '/brand/zrh-ai-icon-64.png',
  icon96: '/brand/zrh-ai-icon-96.png',
  icon180: '/brand/zrh-ai-icon-180.png',
  icon192: '/brand/zrh-ai-icon-192.png',
  icon256: '/brand/zrh-ai-icon-256.png',
  icon512: '/brand/zrh-ai-icon-512.png',
  icon1024: '/brand/zrh-ai-icon-1024.png',
  appleTouch: '/brand/apple-touch-icon.png',
  pwa192: '/brand/pwa-192.png',
  pwa512: '/brand/pwa-512.png',
  og: '/brand/og-share-1200x630.png',
  splashDesktop: '/brand/splash-1280x720.png',
  splashMobile: '/brand/splash-1080x1920.png',
  splashSquare: '/brand/splash-2048.png',
  favicon32: '/favicon-32x32.png',
  favicon16: '/favicon-16x16.png',
} as const;

/** 设计系统统一出口 */
export const designSystem = {
  typography,
  spacing,
  radius,
  shadows,
  motion: motionTokens,
  breakpoints,
  themes,
  themeOrder,
} as const;

/** 将主题色写入 CSS 变量 */
export function applyThemeToDom(themeId: ZrhThemeId): void {
  const theme = themes[isZrhThemeId(themeId) ? themeId : DEFAULT_THEME];
  const root = document.documentElement;
  const c = theme.colors;
  root.dataset.theme = theme.id;
  root.style.colorScheme = theme.scheme;
  root.style.setProperty('--zrh-bg', c.bg);
  root.style.setProperty('--zrh-surface', c.surface);
  root.style.setProperty('--zrh-surface-raised', c.surfaceRaised);
  root.style.setProperty('--zrh-border', c.border);
  root.style.setProperty('--zrh-border-glow', c.borderGlow);
  root.style.setProperty('--zrh-accent', c.accent);
  root.style.setProperty('--zrh-accent-soft', c.accentSoft);
  root.style.setProperty('--zrh-tech-blue', c.techBlue);
  root.style.setProperty('--zrh-on-accent', c.onAccent);
  root.style.setProperty('--zrh-text', c.text);
  root.style.setProperty('--zrh-text-dim', c.textDim);
  root.style.setProperty('--zrh-ok', c.ok);
  root.style.setProperty('--zrh-warn', c.warn);
  root.style.setProperty('--zrh-err', c.err);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', c.bg);
}
