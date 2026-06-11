import { Globe, Menu, Moon, Sun } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import type { LanguagePreference } from "../../types/auth";
import { Button } from "./ui/Button";
import { BusinessSwitcher } from "./BusinessSwitcher";
import { UserProfileMenu } from "./UserProfileMenu";

interface TopbarProps {
  onMenuOpen?: () => void;
}

export function Topbar({ onMenuOpen }: TopbarProps) {
  const { language, setLanguage, translate } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const handleLanguageToggle = () => {
    const next: LanguagePreference = language === "ID" ? "EN" : "ID";
    setLanguage(next);
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 sm:h-16 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 lg:hidden"
          onClick={onMenuOpen}
          aria-label={translate("navOpenMenu")}
          leftIcon={<Menu className="h-5 w-5" />}
        />
        <BusinessSwitcher />
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <div className="hidden items-center gap-0.5 sm:gap-1 md:flex">
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
            <span>{language}</span>
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

          <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:mx-2 md:block dark:bg-slate-700" />
        </div>

        <UserProfileMenu />
      </div>
    </header>
  );
}
