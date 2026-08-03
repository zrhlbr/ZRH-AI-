/**
 * ZRH Design System V2.0 — 色彩
 * 默认：蓝白科技风；Dark：蓝科技深色；黑金等为历史/可选主题。
 * 页面必须经由主题变量取色，禁止硬编码色值。
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
  /** 微光边框 / focus 柔光 */
  borderGlow: string;
  /** 主强调色（V2.0 默认 = 科技蓝） */
  accent: string;
  /** 主强调柔和态 / Hover */
  accentSoft: string;
  /** 科技蓝辅助色 */
  techBlue: string;
  /** 主按钮上的文字色 */
  onAccent: string;
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

/** V2.0 默认 — 蓝白科技风（Light） */
export const blueWhiteColors: ZrhColorTokens = {
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceRaised: '#f1f5f9',
  border: '#e2e8f0',
  borderGlow: 'rgba(37, 99, 235, 0.28)',
  accent: '#2563eb',
  accentSoft: '#3b82f6',
  techBlue: '#3b82f6',
  onAccent: '#ffffff',
  text: '#0f172a',
  textDim: '#64748b',
  ok: '#16a34a',
  warn: '#d97706',
  err: '#dc2626',
};

/** V2.0 Dark Mode — 蓝科技深色（默认关闭，用户手动开启） */
export const blueWhiteDarkColors: ZrhColorTokens = {
  bg: '#0b1220',
  surface: '#111827',
  surfaceRaised: '#1f2937',
  border: '#334155',
  borderGlow: 'rgba(96, 165, 250, 0.35)',
  accent: '#3b82f6',
  accentSoft: '#60a5fa',
  techBlue: '#38bdf8',
  onAccent: '#ffffff',
  text: '#f8fafc',
  textDim: '#94a3b8',
  ok: '#22c55e',
  warn: '#fbbf24',
  err: '#f87171',
};

/** 历史主题 — 黑金（Legacy，非默认） */
export const blackGoldColors: ZrhColorTokens = {
  bg: '#0a0a0b',
  surface: '#141416',
  surfaceRaised: '#1c1c20',
  border: '#2a2a2e',
  borderGlow: 'rgba(212, 175, 55, 0.35)',
  accent: '#d4af37',
  accentSoft: '#b8952e',
  techBlue: '#3b82f6',
  onAccent: '#0a0a0b',
  text: '#f5f3ec',
  textDim: '#9a978c',
  ok: '#4ade80',
  warn: '#fbbf24',
  err: '#f87171',
};

/** 可选 — 深空蓝 */
export const deepSpaceBlueColors: ZrhColorTokens = {
  bg: '#050b18',
  surface: '#0b1526',
  surfaceRaised: '#12203a',
  border: '#1e3355',
  borderGlow: 'rgba(96, 165, 250, 0.35)',
  accent: '#60a5fa',
  accentSoft: '#3b82f6',
  techBlue: '#38bdf8',
  onAccent: '#0b1220',
  text: '#eaf2ff',
  textDim: '#8ba3c7',
  ok: '#34d399',
  warn: '#fbbf24',
  err: '#fb7185',
};

/** 可选 — 暗夜黑 */
export const midnightBlackColors: ZrhColorTokens = {
  bg: '#000000',
  surface: '#0d0d0d',
  surfaceRaised: '#161616',
  border: '#232323',
  borderGlow: 'rgba(228, 228, 231, 0.25)',
  accent: '#e4e4e7',
  accentSoft: '#a1a1aa',
  techBlue: '#71717a',
  onAccent: '#000000',
  text: '#fafafa',
  textDim: '#8f8f8f',
  ok: '#4ade80',
  warn: '#facc15',
  err: '#ef4444',
};
