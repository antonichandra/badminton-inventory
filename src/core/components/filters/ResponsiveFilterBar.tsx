import { useState } from "react";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { FilterBar } from "./FilterBar";
import { FilterBarFields } from "./FilterBarFields";
import { buildAppliedFilterBadges } from "./filterUtils";
import type {
  FilterFieldConfig,
  FilterOptionMap,
  FilterValues,
} from "./types";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { cn } from "../../utils/cn";

interface ResponsiveFilterBarProps {
  fields: FilterFieldConfig[];
  draftValues: FilterValues;
  appliedValues: FilterValues;
  onDraftChange: (values: FilterValues) => void;
  onApply: () => void;
  onReset: () => void;
  optionMap?: FilterOptionMap;
  applyLabel?: string;
  resetLabel?: string;
  panelTitle?: string;
  emptyFilterLabel?: string;
  isApplying?: boolean;
}

export function ResponsiveFilterBar(props: ResponsiveFilterBarProps) {
  const {
    fields,
    draftValues,
    appliedValues,
    onDraftChange,
    onApply,
    onReset,
    optionMap = {},
    applyLabel = "Apply",
    resetLabel = "Reset",
    panelTitle = "Filter",
    emptyFilterLabel = "Semua data",
    isApplying = false,
  } = props;

  const [sheetOpen, setSheetOpen] = useState(false);
  const badges = buildAppliedFilterBadges(fields, appliedValues, optionMap);
  const hasActiveFilters = badges.length > 0;

  const handleApply = () => {
    onApply();
    setSheetOpen(false);
  };

  const handleReset = () => {
    onReset();
    setSheetOpen(false);
  };

  return (
    <>
      <div className="hidden lg:block">
        <FilterBar {...props} />
      </div>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={cn(
            "group w-full rounded-2xl border bg-white p-3.5 text-left shadow-sm transition-all duration-200 active:scale-[0.99]",
            "dark:border-slate-800 dark:bg-slate-900 dark:shadow-none",
            hasActiveFilters
              ? "border-emerald-200/80 ring-1 ring-emerald-100/80 dark:border-emerald-800/60 dark:ring-emerald-950/50"
              : "border-slate-200/90 ring-1 ring-slate-100 hover:border-slate-300 hover:shadow-md dark:ring-slate-800/80 dark:hover:border-slate-700",
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                hasActiveFilters
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                  : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/70 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700/80",
              )}
            >
              <SlidersHorizontal className="h-[18px] w-[18px]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {panelTitle}
                </p>
                {hasActiveFilters && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white dark:bg-emerald-500">
                    {badges.length}
                  </span>
                )}
              </div>

              {hasActiveFilters ? (
                <div className="flex flex-wrap gap-1.5">
                  {badges.map((badge) => (
                    <span
                      key={badge.key}
                      className="inline-flex max-w-full items-center gap-1 truncate rounded-lg border border-emerald-100 bg-emerald-50/80 px-2 py-1 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/30"
                    >
                      <span className="truncate text-slate-500 dark:text-slate-400">
                        {badge.fieldLabel}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="truncate font-medium text-emerald-800 dark:text-emerald-300">
                        {badge.valueLabel}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {emptyFilterLabel}
                </p>
              )}
            </div>

            <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-active:translate-x-0 dark:text-slate-500" />
          </div>
        </button>

        <BottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={panelTitle}
          footer={
            <div className="flex flex-col gap-2.5">
              <Button
                variant="primary"
                className="w-full"
                onClick={handleApply}
                loading={isApplying}
              >
                {applyLabel}
              </Button>
              <Button variant="outline" className="w-full" onClick={handleReset}>
                {resetLabel}
              </Button>
            </div>
          }
        >
          <FilterBarFields
            fields={fields}
            values={draftValues}
            onChange={onDraftChange}
            optionMap={optionMap}
            layout="stack"
          />
        </BottomSheet>
      </div>
    </>
  );
}
