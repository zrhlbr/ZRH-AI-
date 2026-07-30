import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  ZrhThemeId,
  applyThemeToDom,
} from '../design-system/theme';

interface ThemeState {
  themeId: ZrhThemeId;
  /** 背景动画开关（粒子/数据流/网格），聊天性能优先时可关闭 */
  animationsEnabled: boolean;
  setTheme: (id: ZrhThemeId) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeId: DEFAULT_THEME,
      animationsEnabled: true,
      setTheme: (id) => {
        applyThemeToDom(id);
        set({ themeId: id });
      },
      setAnimationsEnabled: (animationsEnabled) => set({ animationsEnabled }),
    }),
    {
      name: THEME_STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        applyThemeToDom(state?.themeId ?? DEFAULT_THEME);
      },
    },
  ),
);

