import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "../../utils/cn";
import { FieldWrapper } from "./FieldWrapper";
import { fieldBaseClass } from "./fieldStyles";
import {
  isRichSelectOption,
  optionMatchesSearch,
  SelectOptionContent,
} from "./SelectOptionContent";
import type { SelectOption } from "./types";

interface MultiDropdownProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
  maxDisplayTags?: number;
}

export function MultiDropdown({
  label,
  hint,
  error,
  required,
  className,
  options,
  value,
  onChange,
  placeholder = "Pilih...",
  searchable = false,
  searchPlaceholder = "Cari...",
  disabled = false,
  emptyMessage = "Tidak ada data",
  maxDisplayTags = 2,
}: MultiDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOptions = options.filter((option) =>
    value.includes(option.value),
  );

  const filteredOptions = useMemo(() => {
    if (!searchable || !search.trim()) return options;
    const term = search.trim();
    return options.filter((option) => optionMatchesSearch(option, term));
  }, [options, search, searchable]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleValue = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((item) => item !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const removeValue = (optionValue: string) => {
    onChange(value.filter((item) => item !== optionValue));
  };

  const displayLabel = () => {
    if (selectedOptions.length === 0) return placeholder;
    if (selectedOptions.length <= maxDisplayTags) {
      return selectedOptions.map((item) => item.label).join(", ");
    }
    return `${selectedOptions.length} dipilih`;
  };

  return (
    <FieldWrapper
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <div ref={containerRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            fieldBaseClass,
            "flex min-h-10 items-center justify-between gap-2 text-left",
            selectedOptions.length === 0 && "text-slate-400 dark:text-slate-500",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <span className="truncate">{displayLabel()}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-400 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>

        {selectedOptions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedOptions.map((option) => (
              <span
                key={option.value}
                className="inline-flex max-w-full items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
              >
                {isRichSelectOption(option) ? (
                  <SelectOptionContent option={option} compact />
                ) : (
                  option.label
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeValue(option.value)}
                    className="rounded p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {open && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
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
                <li className="px-3 py-2 text-sm text-slate-500">
                  {emptyMessage}
                </li>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = value.includes(option.value);
                  return (
                    <li key={option.value}>
                      <button
                        type="button"
                        disabled={option.disabled}
                        onClick={() => toggleValue(option.value)}
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
        )}
      </div>
    </FieldWrapper>
  );
}
