import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ThemePreference } from "../../types/auth";
import { useAuth } from "./AuthContext";

const THEME_STORAGE_KEY = "bi_theme_preference";
const DEFAULT_THEME: ThemePreference = "light";

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeToDom(theme: ThemePreference): void {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function getStoredTheme(): ThemePreference {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, updateTheme, isAuthenticated } = useAuth();
  const [guestTheme, setGuestTheme] =
    useState<ThemePreference>(getStoredTheme);
  const theme = user?.theme ?? guestTheme;

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  const setTheme = useCallback(
    (newTheme: ThemePreference) => {
      applyThemeToDom(newTheme);
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      if (isAuthenticated) {
        void updateTheme(newTheme);
      } else {
        setGuestTheme(newTheme);
      }
    },
    [isAuthenticated, updateTheme],
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
