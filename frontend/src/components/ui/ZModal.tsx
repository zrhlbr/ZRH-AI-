import { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { scaleIn, fadeIn, baseTransition } from '../../design-system/animations';

export interface ZModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
}

/** ZRH Modal — 统一模态框（毛玻璃遮罩 + 缩放动画） */
export function ZModal({ open, onClose, title, children, footer, widthClass = 'max-w-lg' }: ZModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={fadeIn}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={baseTransition}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            variants={scaleIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={baseTransition}
            className={`zrh-glass w-full ${widthClass} rounded-2xl border border-zrh-border p-5 shadow-[0_16px_64px_rgba(0,0,0,0.65)] sm:p-6`}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <h2 className="mb-4 text-base font-semibold text-zrh-accent sm:text-lg">{title}</h2>
            )}
            <div className="text-sm text-zrh-text">{children}</div>
            {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
