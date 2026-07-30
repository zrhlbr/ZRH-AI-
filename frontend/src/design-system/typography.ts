/**
 * ZRH Design System — 字体与排版
 * 中文 / 缅文 / 英文同栈渲染；缅文环境自动切 Noto Sans Myanmar。
 */
export const typography = {
  fontFamily: {
    sans: [
      'Inter',
      '-apple-system',
      'PingFang SC',
      'Microsoft YaHei',
      'Noto Sans Myanmar',
      'sans-serif',
    ].join(', '),
    myanmar: ['Noto Sans Myanmar', 'Padauk', 'sans-serif'].join(', '),
    mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace'].join(', '),
  },
  fontSize: {
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
    brand: '0.2em',
    hud: '0.08em',
  },
} as const;
