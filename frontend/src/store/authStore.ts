import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthProfile {
  id: number;
  username: string;
  displayName: string;
  role: string;
  roleName: string;
  permissions: string[];
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  profile: AuthProfile | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setProfile: (profile: AuthProfile) => void;
  clear: () => void;
  hasPermission: (code: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      profile: null,
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setProfile: (profile) => set({ profile }),
      clear: () => set({ accessToken: null, refreshToken: null, profile: null }),
      hasPermission: (code) => get().profile?.permissions.includes(code) ?? false,
    }),
    { name: 'zrh-ai-auth' },
  ),
);
