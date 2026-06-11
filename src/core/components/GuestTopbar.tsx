import { Globe, Moon, Sun } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import type { LanguagePreference } from "../../types/auth";
import { Button } from "./ui/Button";

export function GuestTopbar() {
  const { language, setLanguage, translate } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const handleLanguageToggle = () => {
    const next: LanguagePreference = language === "ID" ? "EN" : "ID";
    setLanguage(next);
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {translate("appSubtitle")}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLanguageToggle}
          title={
            language === "ID"
              ? translate("languageEN")
              : translate("languageID")
          }
          leftIcon={<Globe className="h-4 w-4" />}
        >
          {language}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          title={
            theme === "light"
              ? translate("themeDark")
              : translate("themeLight")
          }
          aria-label={
            theme === "light"
              ? translate("themeDark")
              : translate("themeLight")
          }
          leftIcon={
            theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )
          }
        />
      </div>
    </header>
  );
}
