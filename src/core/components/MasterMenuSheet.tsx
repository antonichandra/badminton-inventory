import { NavLink } from "react-router-dom";
import type { MenuItem } from "../../types/auth";
import { useLanguage } from "../context/LanguageContext";
import type { TranslationKey } from "../i18n";
import { NavMenuIcon } from "./nav/NavMenuIcon";
import { BottomSheet } from "./ui/BottomSheet";

interface MasterMenuSheetProps {
  open: boolean;
  onClose: () => void;
  items: MenuItem[];
}

export function MasterMenuSheet({
  open,
  onClose,
  items,
}: MasterMenuSheetProps) {
  const { translate } = useLanguage();

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={translate("menuMaster")}
    >
      <div className="space-y-1">
        {items.map((item) =>
          item.path ? (
            <NavLink
              key={item.id}
              to={item.path}
              viewTransition
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-600 text-white"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                }`
              }
            >
              <NavMenuIcon itemId={item.id} />
              <span>{translate(item.labelKey as TranslationKey)}</span>
            </NavLink>
          ) : null,
        )}
      </div>
    </BottomSheet>
  );
}
