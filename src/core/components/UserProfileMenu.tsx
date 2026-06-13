import { Globe, LogOut, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { LanguagePreference } from "../../types/auth";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { navigateWithTransition } from "../utils/viewTransition";
import { PlanBadge } from "./PlanBadge";
import { UserAvatar } from "./UserAvatar";

export function UserProfileMenu() {
  const navigate = useNavigate();
  const { user, logout, sessionToken, role } = useAuth();
  const { language, setLanguage, translate } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAdmin = role?.name === "ADMIN";

  const quotaSummary = useQuery(
    api.businesses.getQuotaSummary,
    sessionToken && isAdmin ? { sessionToken } : "skip",
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLanguageToggle = () => {
    const next: LanguagePreference = language === "ID" ? "EN" : "ID";
    setLanguage(next);
  };

  const handleLogout = () => {
    setOpen(false);
    void logout().then(() => navigateWithTransition(navigate, "/login"));
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 sm:px-1.5"
        aria-label={translate("navProfile")}
      >
        <UserAvatar
          name={user?.name ?? ""}
          picture={user?.picture}
          size="sm"
          className="ring-2 ring-emerald-500/20"
        />
        <div className="hidden text-left md:block">
          <p className="max-w-[140px] truncate text-sm font-medium text-slate-900 lg:max-w-none dark:text-white">
            {user?.name}
          </p>
          <p className="max-w-[140px] truncate text-xs text-slate-500 lg:max-w-none dark:text-slate-400">
            {user?.email}
          </p>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
              {user?.name}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {user?.email}
            </p>
            {isAdmin && quotaSummary?.showQuota && (
              <div className="mt-2">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {translate("sidebarActivePlan")}
                </p>
                <PlanBadge
                  planName={quotaSummary.planName ?? translate("usersNoPlan")}
                />
              </div>
            )}
          </div>

          <div className="p-2">
            <button
              type="button"
              onClick={handleLanguageToggle}
              aria-label={
                language === "ID"
                  ? translate("languageEN")
                  : translate("languageID")
              }
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 md:hidden dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Globe className="h-4 w-4" />
              <span>
                {language === "ID"
                  ? translate("languageID")
                  : translate("languageEN")}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "light"
                  ? translate("themeDark")
                  : translate("themeLight")
              }
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 md:hidden dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {theme === "light" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span>
                {theme === "light"
                  ? translate("themeLight")
                  : translate("themeDark")}
              </span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <LogOut className="h-4 w-4" />
              <span>{translate("navLogout")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
