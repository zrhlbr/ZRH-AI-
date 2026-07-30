/**
 * ZRH Design System — 色彩
 * 黑金为主，科技蓝辅助。所有页面必须经由主题变量取色，禁止硬编码色值。
 */

export interface ZrhColorTokens {
  /** 主背景 */
  bg: string;
  /** 次背景 / 面板 */
  surface: string;
  /** 面板抬升层 */
  surfaceRaised: string;
  /** 边框 */
  border: string;
  /** 微光边框 */
  borderGlow: string;
  /** 主强调色（黑金主题为金色） */
  accent: string;
  /** 主强调柔和态 */
  accentSoft: string;
  /** 科技蓝辅助色 */
  techBlue: string;
  /** 主文本 */
  text: string;
  /** 次级文本 */
  textDim: string;
  /** 成功 */
  ok: string;
  /** 警告 */
  warn: string;
  /** 错误 */
  err: string;
}

/** 黑金（默认） */
export const blackGoldColors: ZrhColorTokens = {
  bg: '#0a0a0b',
  surface: '#141416',
  surfaceRaised: '#1c1c20',
  border: '#2a2a2e',
  borderGlow: 'rgba(212, 175, 55, 0.35)',
  accent: '#d4af37',
  accentSoft: '#b8952e',
  techBlue: '#3b82f6',
  text: '#f5f3ec',
  textDim: '#9a978c',
  ok: '#4ade80',
  warn: '#fbbf24',
  err: '#f87171',
};

/** 深空蓝 */
export const deepSpaceBlueColors: ZrhColorTokens = {
  bg: '#050b18',
  surface: '#0b1526',
  surfaceRaised: '#12203a',
  border: '#1e3355',
  borderGlow: 'rgba(96, 165, 250, 0.35)',
  accent: '#60a5fa',
  accentSoft: '#3b82f6',
  techBlue: '#38bdf8',
  text: '#eaf2ff',
  textDim: '#8ba3c7',
  ok: '#34d399',
  warn: '#fbbf24',
  err: '#fb7185',
};

/** 暗夜黑 */
export const midnightBlackColors: ZrhColorTokens = {
  bg: '#000000',
  surface: '#0d0d0d',
  surfaceRaised: '#161616',
  border: '#232323',
  borderGlow: 'rgba(228, 228, 231, 0.25)',
  accent: '#e4e4e7',
  accentSoft: '#a1a1aa',
  techBlue: '#71717a',
  text: '#fafafa',
  textDim: '#8f8f8f',
  ok: '#4ade80',
  warn: '#facc15',
  err: '#ef4444',
};
