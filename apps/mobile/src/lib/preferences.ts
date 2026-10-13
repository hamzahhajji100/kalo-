import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Small, non-health UI preferences. Health data lives in SQLite, not here. */
export interface Preferences {
  theme: 'system' | 'light' | 'dark';
  language: 'system' | 'de' | 'en';
  units: 'metric' | 'imperial';
  /** Relaxed mode hides calorie numbers and shows food-quality focused feedback instead. */
  relaxedMode: boolean;
  hasOnboarded: boolean;
  set: (patch: Partial<Omit<Preferences, 'set'>>) => void;
}

export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'system',
      units: 'metric',
      relaxedMode: false,
      hasOnboarded: false,
      set: (patch) => set(patch),
    }),
    {
      name: 'kalo.preferences',
      storage: createJSONStorage(() => Storage),
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
);
