import { ButtonHTMLAttributes, forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ZButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'>,
  Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'disabled' | 'type' | 'onClick'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary:
    'bg-zrh-accent text-zrh-bg font-semibold hover:bg-zrh-accent-soft disabled:opacity-50',
  secondary:
    'border border-zrh-accent/40 text-zrh-accent hover:bg-zrh-accent/10 disabled:opacity-50',
  ghost:
    'text-zrh-text-dim hover:text-zrh-text hover:bg-zrh-surface-raised disabled:opacity-50',
  danger:
    'border border-zrh-err/40 text-zrh-err hover:bg-zrh-err/10 disabled:opacity-50',
};

const sizeClass: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-lg',
};

/** ZRH Button — 统一按钮（设计系统驱动，禁止页面内自写按钮样式） */
export const ZButton = forwardRef<HTMLButtonElement, ZButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, children, ...rest }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      transition={{ duration: 0.1 }}
      className={`inline-flex items-center justify-center gap-2 transition-colors ${variantClass[variant]} ${sizeClass[size]}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </motion.button>
  ),
);
ZButton.displayName = 'ZButton';
