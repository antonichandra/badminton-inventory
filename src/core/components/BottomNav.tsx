import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, MoreHorizontal } from "lucide-react";
import {
  buildPrimaryNavItems,
  getMasterGroup,
  isMasterRoute,
} from "../config/navigation";
import { useMenu } from "../hooks/useMenu";
import { useLanguage } from "../context/LanguageContext";
import type { TranslationKey } from "../i18n";
import { MasterMenuSheet } from "./MasterMenuSheet";
import { NavMenuIcon } from "./nav/NavMenuIcon";

function BottomNavIcon({ itemId }: { itemId: string }) {
  if (itemId === "dashboard") {
    return <LayoutDashboard className="h-5 w-5 shrink-0" />;
  }
  return <NavMenuIcon itemId={itemId} className="h-5 w-5 shrink-0" />;
}

export function BottomNav() {
  const menu = useMenu();
  const { translate } = useLanguage();
  const location = useLocation();
  const [masterOpen, setMasterOpen] = useState(false);

  const primaryItems = buildPrimaryNavItems(menu);
  const masterGroup = getMasterGroup(menu);
  const masterActive = isMasterRoute(location.pathname);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95"
        aria-label={translate("navOpenMenu")}
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          {primaryItems.map((item) =>
            item.path ? (
              <NavLink
                key={item.id}
                to={item.path}
                viewTransition
                className={({ isActive }) =>
                  `flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors ${
                    isActive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  }`
                }
              >
                <BottomNavIcon itemId={item.id} />
                <span className="max-w-full truncate">
                  {translate(item.labelKey as TranslationKey)}
                </span>
              </NavLink>
            ) : null,
          )}

          {masterGroup && (
            <button
              type="button"
              onClick={() => setMasterOpen(true)}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors ${
                masterActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <MoreHorizontal className="h-5 w-5 shrink-0" />
              <span className="max-w-full truncate">{translate("navMore")}</span>
            </button>
          )}
        </div>
      </nav>

      {masterGroup?.children && (
        <MasterMenuSheet
          open={masterOpen}
          onClose={() => setMasterOpen(false)}
          items={masterGroup.children}
        />
      )}
    </>
  );
}
