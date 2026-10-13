import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { useColorScheme, vars } from 'nativewind';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';

import { usePreferences } from '@/lib/preferences';
import { dark, light, rgb, type Palette } from './tokens';

const toVars = (palette: Palette) =>
  vars(Object.fromEntries(Object.entries(palette).map(([k, v]) => [`--${k}`, v])));

const lightVars = toVars(light);
const darkVars = toVars(dark);

interface ThemeValue {
  isDark: boolean;
  palette: Palette;
  /** Resolve a token to an `rgb()` colour string. */
  color: (token: keyof Palette, alpha?: number) => string;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themePreference = usePreferences((s) => s.theme);
  const { colorScheme, setColorScheme } = useColorScheme();

  useEffect(() => {
    setColorScheme(themePreference);
  }, [themePreference, setColorScheme]);

  const isDark = colorScheme === 'dark';
  const value = useMemo<ThemeValue>(() => {
    const palette = isDark ? dark : light;
    return { isDark, palette, color: (token, alpha) => rgb(palette, token, alpha) };
  }, [isDark]);

  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: value.color('brand'),
        background: value.color('bg'),
        card: value.color('surface'),
        text: value.color('text'),
        border: value.color('border'),
      },
    };
  }, [isDark, value]);

  return (
    <ThemeContext.Provider value={value}>
      <NavigationThemeProvider value={navTheme}>
        <View style={[{ flex: 1 }, isDark ? darkVars : lightVars]} className="bg-bg">
          {children}
        </View>
      </NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
