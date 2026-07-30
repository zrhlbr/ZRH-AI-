import type { Variants, Transition } from 'framer-motion';

/**
 * ZRH Design System — 动画（统一 Framer Motion 曲线）
 * 原则：快入缓出、短促、克制，禁止花哨与闪屏。
 */
export const motionTokens = {
  ease: {
    standard: [0.4, 0, 0.2, 1] as const,
    out: [0, 0, 0.2, 1] as const,
    inOut: [0.4, 0, 0.6, 1] as const,
  },
  duration: {
    fast: 0.15,
    base: 0.25,
    slow: 0.4,
  },
} as const;

export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

export const baseTransition: Transition = {
  duration: motionTokens.duration.base,
  ease: motionTokens.ease.standard,
};
