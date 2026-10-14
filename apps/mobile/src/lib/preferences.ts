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
  /** One-time consent to send meal/label photos to the Kalo server for AI analysis. */
  photoConsent: boolean;
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
      photoConsent: false,
      set: (patch) => set(patch),
    }),
    {
      name: 'kalo.preferences',
      // Synchronous storage so preferences (e.g. onboarding state) are available on the first render.
      storage: createJSONStorage(() => ({
        getItem: (k: string) => Storage.getItemSync(k),
        setItem: (k: string, v: string) => Storage.setItemSync(k, v),
        removeItem: (k: string) => Storage.removeItemSync(k),
      })),
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
);
