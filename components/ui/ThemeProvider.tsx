import AsyncStorage from "@react-native-async-storage/async-storage";
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { getTheme, type Theme, type ThemeMode } from "./theme";

const THEME_MODE_STORAGE_KEY = "fen.themeMode";
const DEFAULT_THEME_MODE: ThemeMode = "dark";

type ThemeContextValue = {
  theme: Theme;
  mode: ThemeMode;
  isThemeLoaded: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleThemeMode: () => Promise<void>;
};

const fallbackContext: ThemeContextValue = {
  theme: getTheme(DEFAULT_THEME_MODE),
  mode: DEFAULT_THEME_MODE,
  isThemeLoaded: true,
  setThemeMode: async () => {},
  toggleThemeMode: async () => {},
};

const ThemeContext = createContext<ThemeContextValue>(fallbackContext);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light";
}

async function readStoredThemeMode(): Promise<ThemeMode | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || !window.localStorage) return null;
      const value = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
      return isThemeMode(value) ? value : null;
    }

    const value = await AsyncStorage.getItem(THEME_MODE_STORAGE_KEY);
    return isThemeMode(value) ? value : null;
  } catch {
    return null;
  }
}

async function writeStoredThemeMode(mode: ThemeMode) {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || !window.localStorage) return;
      window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
      return;
    }

    await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  } catch {
    // Theme preference is local convenience only. Ignore storage failures and keep the in-memory mode.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    readStoredThemeMode()
      .then((storedMode) => {
        if (!active) return;
        if (storedMode) setMode(storedMode);
      })
      .finally(() => {
        if (active) setIsThemeLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const setThemeMode = useCallback(async (nextMode: ThemeMode) => {
    setMode(nextMode);
    await writeStoredThemeMode(nextMode);
  }, []);

  const toggleThemeMode = useCallback(async () => {
    const nextMode = mode === "dark" ? "light" : "dark";
    await setThemeMode(nextMode);
  }, [mode, setThemeMode]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme: getTheme(mode),
    mode,
    isThemeLoaded,
    setThemeMode,
    toggleThemeMode,
  }), [isThemeLoaded, mode, setThemeMode, toggleThemeMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext).theme;
}

export function useThemeMode() {
  const { mode, isThemeLoaded, setThemeMode, toggleThemeMode } = useContext(ThemeContext);
  return { mode, isThemeLoaded, setThemeMode, toggleThemeMode };
}
