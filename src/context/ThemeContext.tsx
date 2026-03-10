import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme as staticTheme } from '../theme';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  backgroundDark: string;
  surface: string;
  text: string;
  textSecondary: string;
  textLight: string;
  border: string;
  divider: string;
  error: string;
  success: string;
  successLight: string;
  warning: string;
  info: string;
  gray: string;
  lightGray: string;
  darkGray: string;
}

export const lightColors: ThemeColors = {
  primary: '#000000',
  secondary: '#FFFFFF',
  accent: '#004732',
  background: '#F5F5F5',
  backgroundDark: '#000000',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#666666',
  textLight: '#FFFFFF',
  border: '#E0E0E0',
  divider: '#EEEEEE',
  error: '#D32F2F',
  success: '#1B5E20',
  successLight: '#E8F5E9',
  warning: '#FFA000',
  info: '#2196F3',
  gray: '#808080',
  lightGray: '#D3D3D3',
  darkGray: '#333333',
};

export const darkColors: ThemeColors = {
  primary: '#FFFFFF',
  secondary: '#1A1A1A',
  accent: '#006345',
  background: '#121212',
  backgroundDark: '#000000',
  surface: '#1E1E1E',
  text: '#F5F5F5',
  textSecondary: '#A0A0A0',
  textLight: '#FFFFFF',
  border: '#333333',
  divider: '#2A2A2A',
  error: '#FF6B6B',
  success: '#00A67E',
  successLight: '#1A3A2A',
  warning: '#FFB74D',
  info: '#64B5F6',
  gray: '#808080',
  lightGray: '#404040',
  darkGray: '#E0E0E0',
};

// Full theme type with colors
type FullTheme = typeof staticTheme & { colors: ThemeColors };

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  theme: FullTheme;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@nmj_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
          setThemeModeState(saved as ThemeMode);
        }
      } catch (error) {
        console.error('[ThemeContext] Error loading theme:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadTheme();
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemColorScheme]);

  const colors = useMemo(() => (isDark ? darkColors : lightColors), [isDark]);

  // Full theme object with dynamic colors
  const theme = useMemo<FullTheme>(() => ({
    ...staticTheme,
    colors,
  }), [colors]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('[ThemeContext] Error saving theme:', error);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newMode = isDark ? 'light' : 'dark';
    setThemeMode(newMode);
  }, [isDark, setThemeMode]);

  const value = useMemo(
    () => ({ themeMode, isDark, colors, theme, setThemeMode, toggleTheme }),
    [themeMode, isDark, colors, theme, setThemeMode, toggleTheme]
  );

  if (!isLoaded) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// Hook para usar o tema dinâmico - USE ESTE nas telas
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Hook que retorna apenas o theme completo (shortcut)
export const useAppTheme = () => {
  const { theme, isDark } = useTheme();
  return { theme, isDark };
};

export type { ThemeColors, ThemeMode, FullTheme };
