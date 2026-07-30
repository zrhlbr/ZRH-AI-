/**
 * ZRH Design System — 圆角
 */
export const radius = {
  none: '0',
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.25rem',
  full: '9999px',
} as const;

export type ZrhRadius = keyof typeof radius;
