import { ReactNode, useState } from 'react';
import { motion } from 'framer-motion';

export interface ZTabItem {
  key: string;
  label: ReactNode;
  content: ReactNode;
}

export interface ZTabsProps {
  tabs: ZTabItem[];
  defaultKey?: string;
  onChange?: (key: string) => void;
}

/** ZRH Tabs — 统一标签页（滑动指示条） */
export function ZTabs({ tabs, defaultKey, onChange }: ZTabsProps) {
  const [active, setActive] = useState(defaultKey ?? tabs[0]?.key);

  const select = (key: string) => {
    setActive(key);
    onChange?.(key);
  };

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-zrh-border">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => select(tab.key)}
              className={`relative whitespace-nowrap px-4 py-2 text-sm transition-colors ${
                isActive ? 'text-zrh-accent font-semibold' : 'text-zrh-text-dim hover:text-zrh-text'
              }`}
            >
              {tab.label}
              {isActive && (
                <motion.span
                  layoutId="zrh-tab-indicator"
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-zrh-accent"
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="pt-4">{tabs.find((t) => t.key === active)?.content}</div>
    </div>
  );
}
