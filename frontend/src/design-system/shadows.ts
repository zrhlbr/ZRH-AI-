/**
 * ZRH Design System — 阴影与光效（克制，不使用廉价发光）
 */
export const shadows = {
  card: '0 4px 24px rgba(0, 0, 0, 0.45)',
  raised: '0 8px 40px rgba(0, 0, 0, 0.55)',
  modal: '0 16px 64px rgba(0, 0, 0, 0.65)',
  /** 微光边框用内阴影 + 外阴影组合，颜色取自主题 borderGlow */
  glow: '0 0 0 1px var(--zrh-border-glow), 0 0 24px -8px var(--zrh-border-glow)',
  focusRing: '0 0 0 2px var(--zrh-bg), 0 0 0 4px var(--zrh-accent)',
} as const;
