import {
  ZrhColorTokens,
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
 * ZRH Design System — 主题注册表
 * 黑金（默认）/ 深空蓝 / 暗夜黑；通过 <html data-theme> 切换 CSS 变量。
 */

export type ZrhThemeId = 'black-gold' | 'deep-space-blue' | 'midnight-black';

export interface ZrhTheme {
  id: ZrhThemeId;
  /** i18n key，位于 theme.* 命名空间 */
  labelKey: string;
  colors: ZrhColorTokens;
}

export const themes: Record<ZrhThemeId, ZrhTheme> = {
  'black-gold': { id: 'black-gold', labelKey: 'theme.blackGold', colors: blackGoldColors },
  'deep-space-blue': { id: 'deep-space-blue', labelKey: 'theme.deepSpaceBlue', colors: deepSpaceBlueColors },
  'midnight-black': { id: 'midnight-black', labelKey: 'theme.midnightBlack', colors: midnightBlackColors },
};

export const DEFAULT_THEME: ZrhThemeId = 'black-gold';
export const THEME_STORAGE_KEY = 'zrh-ai-theme';

/** 品牌常量（品牌资产不做翻译，全球统一） */
export const brand = {
  name: 'ZRH AI',
  logo: 'ZRH AI',
  subtitle: 'ZRH Technology Group',
  groupZh: 'ZRH 科技集团',
  groupEn: 'ZRH TECHNOLOGY GROUP',
  copyright: '© ZRH Technology Group',
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
} as const;

/** 将主题色写入 CSS 变量 */
export function applyThemeToDom(themeId: ZrhThemeId): void {
  const theme = themes[themeId] ?? themes[DEFAULT_THEME];
  const root = document.documentElement;
  const c = theme.colors;
  root.dataset.theme = theme.id;
  root.style.setProperty('--zrh-bg', c.bg);
  root.style.setProperty('--zrh-surface', c.surface);
  root.style.setProperty('--zrh-surface-raised', c.surfaceRaised);
  root.style.setProperty('--zrh-border', c.border);
  root.style.setProperty('--zrh-border-glow', c.borderGlow);
  root.style.setProperty('--zrh-accent', c.accent);
  root.style.setProperty('--zrh-accent-soft', c.accentSoft);
  root.style.setProperty('--zrh-tech-blue', c.techBlue);
  root.style.setProperty('--zrh-text', c.text);
  root.style.setProperty('--zrh-text-dim', c.textDim);
  root.style.setProperty('--zrh-ok', c.ok);
  root.style.setProperty('--zrh-warn', c.warn);
  root.style.setProperty('--zrh-err', c.err);
}
