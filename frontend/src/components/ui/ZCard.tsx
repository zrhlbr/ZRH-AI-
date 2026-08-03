import { ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { fadeInUp, baseTransition } from '../../design-system/animations';

export interface ZCardProps extends Omit<HTMLMotionProps<'div'>, 'title' | 'children'> {
  title?: ReactNode;
  extra?: ReactNode;
  glow?: boolean;
  hud?: boolean;
  padded?: boolean;
  children?: ReactNode;
}

/** ZRH Card — 统一面板卡片（可选微光边框 / HUD 角标） */
export function ZCard({
  title,
  extra,
  glow,
  hud,
  padded = true,
  className = '',
  children,
  ...rest
}: ZCardProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      transition={baseTransition}
      className={`zrh-hover-lift rounded-xl border border-zrh-border bg-zrh-surface shadow-zrh-card ${
        glow ? 'zrh-glow-border' : ''
      } ${hud ? 'zrh-hud' : ''} ${padded ? 'p-4 sm:p-5' : ''} ${className}`}
      {...rest}
    >
      {(title || extra) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-sm font-semibold text-zrh-accent sm:text-base">{title}</h3>}
          {extra}
        </div>
      )}
      {children}
    </motion.div>
  );
}
