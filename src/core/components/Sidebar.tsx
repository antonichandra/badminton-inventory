import { NavLink } from "react-router-dom";
import { ChevronDown, LayoutDashboard, Package, Store, X } from "lucide-react";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { MenuItem } from "../../types/auth";
import { MENU_ICONS } from "../config/menuIcons";
import { useAuth } from "../context/AuthContext";
import { useBusiness } from "../context/BusinessContext";
import { useMenu } from "../hooks/useMenu";
import { useLanguage } from "../context/LanguageContext";
import type { TranslationKey } from "../i18n";
import { PlanBadge } from "./PlanBadge";
import { Button } from "./ui/Button";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

function MenuIcon({ itemId }: { itemId: string }) {
  const Icon = MENU_ICONS[itemId] ?? Package;
  return <Icon className="h-4 w-4 shrink-0" />;
}

function MenuLink({
  item,
  onNavigate,
}: {
  item: MenuItem;
  onNavigate?: () => void;
}) {
  const { translate } = useLanguage();

  if (!item.path) return null;

  return (
    <NavLink
      to={item.path}
      viewTransition
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
          isActive
            ? "bg-emerald-600 text-white"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        }`
      }
    >
      <MenuIcon itemId={item.id} />
      <span>{translate(item.labelKey as TranslationKey)}</span>
    </NavLink>
  );
}

function MenuGroup({
  item,
  onNavigate,
}: {
  item: MenuItem;
  onNavigate?: () => void;
}) {
  const { translate } = useLanguage();
  const [isOpen, setIsOpen] = useState(true);

  if (!item.children?.length) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
      >
        <span className="flex items-center gap-2">
          <MenuIcon itemId={item.id} />
          {translate(item.labelKey as TranslationKey)}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
        />
      </button>
      {isOpen && (
        <div className="mt-1 space-y-0.5 pl-2">
          {item.children.map((child) => (
            <MenuLink key={child.id} item={child} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const menu = useMenu();
  const { translate } = useLanguage();
  const { sessionToken, role } = useAuth();
  const { activeBusiness } = useBusiness();
  const isAdmin = role?.name === "ADMIN";

  const quotaSummary = useQuery(
    api.businesses.getQuotaSummary,
    sessionToken && isAdmin ? { sessionToken } : "skip",
  );

  const headerTitle = activeBusiness?.name ?? translate("appName");
  const adminPlanName =
    quotaSummary?.planName ?? translate("usersNoPlan");

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={onClose}
          aria-label={translate("navCloseMenu")}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-svh min-h-svh max-h-svh w-[min(100vw-1rem,17rem)] shrink-0 flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-in-out sm:w-64 lg:static lg:h-auto lg:min-h-screen lg:max-h-none lg:translate-x-0 lg:self-stretch lg:shadow-none dark:border-slate-800 dark:bg-slate-900 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5 sm:py-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {headerTitle}
              </p>
              {/* <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {translate("appSubtitle")}
              </p> */}
              {isAdmin && quotaSummary?.showQuota && (
                <div className="mt-1.5">
                  <PlanBadge
                    planName={adminPlanName}
                    className="px-2 py-0.5 text-[10px]"
                  />
                </div>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 lg:hidden"
            onClick={onClose}
            aria-label={translate("navCloseMenu")}
            leftIcon={<X className="h-4 w-4" />}
          />
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
          <NavLink
            to="/dashboard"
            viewTransition
            onClick={onClose}
            className={({ isActive }) =>
              `mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? "bg-emerald-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`
            }
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span>{translate("navDashboard")}</span>
          </NavLink>

          <NavLink
            to="/analytics"
            viewTransition
            onClick={onClose}
            className={({ isActive }) =>
              `mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? "bg-emerald-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`
            }
          >
            <MenuIcon itemId="analytics" />
            <span>{translate("menuAnalytics")}</span>
          </NavLink>

          {menu.map((item) =>
            item.children ? (
              <MenuGroup
                key={item.id}
                item={item}
                onNavigate={onClose}
              />
            ) : (
              <MenuLink key={item.id} item={item} onNavigate={onClose} />
            ),
          )}
        </nav>
      </aside>
    </>
  );
}
