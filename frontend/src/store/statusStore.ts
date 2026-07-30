import { create } from 'zustand';
import { api, HealthReport, OllamaModelsResponse, OllamaStatus } from '../api/client';

interface StatusState {
  loading: boolean;
  error: string | null;
  health: HealthReport | null;
  ollama: OllamaStatus | null;
  models: OllamaModelsResponse | null;
  refresh: () => Promise<void>;
}

export const useStatusStore = create<StatusState>((set) => ({
  loading: false,
  error: null,
  health: null,
  ollama: null,
  models: null,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const [health, ollama, models] = await Promise.all([
        api.health(),
        api.ollamaHealth(),
        api.ollamaModels(),
      ]);
      set({ health, ollama, models, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
}));
