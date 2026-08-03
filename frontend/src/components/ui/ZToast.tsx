import { create } from 'zustand';
import { AnimatePresence, motion } from 'framer-motion';

type ToastTone = 'ok' | 'err' | 'warn' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

let seq = 1;

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, tone = 'info') => {
    const id = seq++;
    set((s) => ({ items: [...s.items.slice(-4), { id, message, tone }] }));
    window.setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
    }, 3200);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export function toast(message: string, tone: ToastTone = 'info') {
  useToastStore.getState().push(message, tone);
}

const toneClass: Record<ToastTone, string> = {
  ok: 'border-zrh-ok/40 text-zrh-ok',
  err: 'border-zrh-err/40 text-zrh-err',
  warn: 'border-zrh-warn/40 text-zrh-warn',
  info: 'border-zrh-accent/40 text-zrh-accent',
};

/** Global toast host — mount once near app root */
export function ZToastHost() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(92vw,22rem)] flex-col gap-2">
      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className={`pointer-events-auto zrh-glass rounded-xl border px-3.5 py-2.5 text-xs shadow-lg ${toneClass[item.tone]}`}
            role="status"
            onClick={() => dismiss(item.id)}
          >
            {item.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
