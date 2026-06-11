import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LanguagePreference } from "../../types/auth";
import { t, type TranslationKey } from "../i18n";
import { useAuth } from "./AuthContext";

const LANGUAGE_STORAGE_KEY = "bi_language_preference";

interface LanguageContextValue {
  language: LanguagePreference;
  setLanguage: (language: LanguagePreference) => void;
  translate: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getStoredLanguage(): LanguagePreference {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === "EN" ? "EN" : "ID";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user, updateLanguage, isAuthenticated } = useAuth();
  const [guestLanguage, setGuestLanguage] =
    useState<LanguagePreference>(getStoredLanguage);
  const language = user?.language ?? guestLanguage;

  const setLanguage = useCallback(
    (newLanguage: LanguagePreference) => {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, newLanguage);
      if (isAuthenticated) {
        void updateLanguage(newLanguage);
      } else {
        setGuestLanguage(newLanguage);
      }
    },
    [isAuthenticated, updateLanguage],
  );

  const translate = useCallback(
    (key: TranslationKey) => t(language, key),
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, translate }),
    [language, setLanguage, translate],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
