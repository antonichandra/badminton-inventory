import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "../../utils/cn";
import { fieldBaseClass } from "./fieldStyles";
import {
  isRichSelectOption,
  optionMatchesSearch,
  SelectOptionContent,
} from "./SelectOptionContent";
import type { SelectOption } from "./types";

const MENU_GAP_PX = 4;
const MENU_LIST_MAX_PX = 224;
const MENU_SEARCH_HEIGHT_PX = 52;
const MENU_Z_INDEX = 70;

interface DropdownPanelProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  emptyMessage?: string;
}

function getMenuStyle(
  rect: DOMRect,
  searchable: boolean,
): CSSProperties {
  const maxMenuHeight =
    MENU_LIST_MAX_PX + (searchable ? MENU_SEARCH_HEIGHT_PX : 0);
  const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP_PX;
  const spaceAbove = rect.top - MENU_GAP_PX;
  const openUp =
    spaceBelow < Math.min(maxMenuHeight, 160) && spaceAbove > spaceBelow;

  if (openUp) {
    return {
      position: "fixed",
      left: rect.left,
      width: rect.width,
      bottom: window.innerHeight - rect.top + MENU_GAP_PX,
      zIndex: MENU_Z_INDEX,
    };
  }

  return {
    position: "fixed",
    top: rect.bottom + MENU_GAP_PX,
    left: rect.left,
    width: rect.width,
    zIndex: MENU_Z_INDEX,
  };
}

export function DropdownPanel({
  options,
  value,
  onChange,
  placeholder = "Pilih...",
  searchable = false,
  searchPlaceholder = "Cari...",
  disabled = false,
  clearable = false,
  className,
  emptyMessage = "Tidak ada data",
}: DropdownPanelProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);

  const filteredOptions = useMemo(() => {
    if (!searchable || !search.trim()) return options;
    const term = search.trim();
    return options.filter((option) => optionMatchesSearch(option, term));
  }, [options, search, searchable]);

  const updateMenuPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuStyle(getMenuStyle(rect, searchable));
  }, [searchable]);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
      setSearch("");
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
    setSearch("");
  };

  const menu = open ? (
    <div
      ref={menuRef}
      style={menuStyle}
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
    >
      {searchable && (
        <div className="border-b border-slate-100 p-2 dark:border-slate-800">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              placeholder={searchPlaceholder}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>
      )}

      <ul className="max-h-56 overflow-y-auto py-1">
        {filteredOptions.length === 0 ? (
          <li className="px-3 py-2 text-sm text-slate-500">{emptyMessage}</li>
        ) : (
          filteredOptions.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  disabled={option.disabled}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors",
                    isSelected
                      ? "bg-emerald-50 dark:bg-emerald-950/40"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800",
                    option.disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <SelectOptionContent option={option} />
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  ) : null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((prev) => {
            const next = !prev;
            if (next) {
              requestAnimationFrame(updateMenuPosition);
            }
            return next;
          });
        }}
        className={cn(
          fieldBaseClass,
          "flex min-h-10 items-center justify-between gap-2 text-left",
          !selected && "text-slate-400 dark:text-slate-500",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="min-w-0 flex-1">
          {selected ? (
            isRichSelectOption(selected) ? (
              <SelectOptionContent option={selected} compact />
            ) : (
              <span className="truncate">{selected.label}</span>
            )
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onChange("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.stopPropagation();
                  onChange("");
                }
              }}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-400 transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
      </button>

      {menu && createPortal(menu, document.body)}
    </div>
  );
}
