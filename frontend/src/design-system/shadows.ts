/**
 * ZRH Design System V2.0 — 阴影（Light 克制；Dark 略深）
 * 具体深浅由主题 CSS 变量微调。
 */
export const shadows = {
  card: 'var(--zrh-shadow-card)',
  raised: 'var(--zrh-shadow-raised)',
  modal: 'var(--zrh-shadow-modal)',
  glow: '0 0 0 1px var(--zrh-border-glow), 0 0 24px -8px var(--zrh-border-glow)',
  focusRing: '0 0 0 2px var(--zrh-bg), 0 0 0 4px var(--zrh-accent)',
} as const;
