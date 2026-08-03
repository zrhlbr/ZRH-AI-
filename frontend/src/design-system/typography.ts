/**
 * ZRH Design System — 字体与排版
 * Space Grotesk（品牌/UI）+ Noto Sans SC（中文）+ Noto Sans Myanmar（缅文）
 */
export const typography = {
  fontFamily: {
    sans: [
      'Space Grotesk',
      'Noto Sans SC',
      'Noto Sans Myanmar',
      'PingFang SC',
      'Microsoft YaHei',
      'sans-serif',
    ].join(', '),
    display: ['Space Grotesk', 'Noto Sans SC', 'sans-serif'].join(', '),
    myanmar: ['Noto Sans Myanmar', 'Padauk', 'sans-serif'].join(', '),
    mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace'].join(', '),
  },
  fontSize: {
    caption: '0.6875rem', // 11px — 辅助说明 / 状态微文案
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  letterSpacing: {
    brand: '0.18em', // Round 3：略收紧，提升中英可读性
    hud: '0.06em',
  },
  lineHeight: {
    tight: '1.2',
    snug: '1.35',
    normal: '1.5',
    relaxed: '1.625',
  },
  /** V1.2.2 Mobile：正文 400/500，标题 600 */
  mobile: {
    bodyWeight: 400,
    labelWeight: 500,
    titleWeight: 600,
    bodyLineHeight: 1.5,
  },
} as const;
