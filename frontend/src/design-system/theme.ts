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
  iconVersion: 'ZRH Official Logo (Blue Tech)',
  designSystem: 'ZRH Design System V2.0',
  /** Product release shown in landing / release-notes / footer */
  appVersion: '1.2.1',
} as const;

/** 官方 Logo 资产路径 — 唯一母版派生自 /branding/zrh-logo-blue-white-master.png */
export const brandAssets = {
  master: '/branding/zrh-logo-blue-white-master.png',
  logo: '/branding/zrh-logo.png',
  iconSvg: '/branding/zrh-logo.svg',
  icon32: '/branding/zrh-logo-32.png',
  icon48: '/branding/zrh-logo-48.png',
  icon64: '/branding/zrh-logo-64.png',
  icon96: '/branding/zrh-logo-96.png',
  icon180: '/branding/zrh-logo-180.png',
  icon192: '/branding/zrh-logo-192.png',
  icon256: '/branding/zrh-logo-256.png',
  icon512: '/branding/zrh-logo-512.png',
  icon1024: '/branding/zrh-logo-1024.png',
  appleTouch: '/branding/apple-touch-icon.png',
  pwa192: '/branding/manifest-icon-192.png',
  pwa512: '/branding/manifest-icon-512.png',
  og: '/branding/og-share-1200x630.png',
  splashDesktop: '/branding/splash-1280x720.png',
  splashMobile: '/branding/splash-1080x1920.png',
  splashSquare: '/branding/splash-2048.png',
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
