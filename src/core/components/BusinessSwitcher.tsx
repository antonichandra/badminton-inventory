import { Building2, ChevronDown } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { useBusiness } from "../context/BusinessContext";
import { useLanguage } from "../context/LanguageContext";
import { useToast } from "../context/ToastContext";
import { cn } from "../utils/cn";

export function BusinessSwitcher() {
  const { translate } = useLanguage();
  const { showToast } = useToast();
  const { businesses, activeBusiness, showSwitcher, setActiveBusiness } =
    useBusiness();
  const [open, setOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  if (!showSwitcher || !activeBusiness) {
    return null;
  }

  const handleSelect = async (businessId: typeof activeBusiness._id) => {
    if (isSwitching || businessId === activeBusiness._id) {
      setOpen(false);
      return;
    }

    setIsSwitching(true);
    try {
      await setActiveBusiness(businessId);
      setOpen(false);
    } catch (error) {
      const raw = String(error);
      const message = raw.includes("BUSINESS_NOT_ACTIVE")
        ? translate("businessSwitchNotActive")
        : raw.includes("FORBIDDEN")
          ? translate("businessSwitchForbidden")
          : translate("businessSwitchError");
      showToast({ type: "error", message });
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div ref={containerRef} className="relative min-w-0 max-w-[45vw] sm:max-w-none">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={isSwitching}
        className="flex max-w-[220px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm transition-colors hover:bg-slate-50 disabled:opacity-60 lg:max-w-[280px] dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      >
        <Building2 className="h-4 w-4 shrink-0 text-emerald-600" />
        <span className="truncate font-medium text-slate-900 dark:text-white">
          {activeBusiness.name}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-full min-w-[220px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <ul className="max-h-56 overflow-y-auto py-1">
            {businesses.map((business) => {
              const isActive = business._id === activeBusiness._id;
              return (
                <li key={business._id}>
                  <button
                    type="button"
                    onClick={() => void handleSelect(business._id)}
                    disabled={isSwitching}
                    className={cn(
                      "flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors",
                      isActive
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800",
                    )}
                  >
                    <span className="truncate font-medium">{business.name}</span>
                    {business.isDefault && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {translate("businessDefaultBadge")}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
