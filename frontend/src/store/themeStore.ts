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
  setTheme: (id: ZrhThemeId) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeId: DEFAULT_THEME,
      setTheme: (id) => {
        applyThemeToDom(id);
        set({ themeId: id });
      },
    }),
    {
      name: THEME_STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        applyThemeToDom(state?.themeId ?? DEFAULT_THEME);
      },
    },
  ),
);

