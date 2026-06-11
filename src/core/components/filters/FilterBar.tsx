import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { Button } from "../ui/Button";
import { FilterBarFields } from "./FilterBarFields";
import type {
  FilterFieldConfig,
  FilterOptionMap,
  FilterValues,
} from "./types";
import { cn } from "../../utils/cn";

const DESKTOP_VISIBLE_FILTER_COUNT = 3;

interface FilterBarProps {
  fields: FilterFieldConfig[];
  draftValues: FilterValues;
  onDraftChange: (values: FilterValues) => void;
  onApply: () => void;
  onReset: () => void;
  optionMap?: FilterOptionMap;
  applyLabel?: string;
  resetLabel?: string;
  isApplying?: boolean;
}

function hasFilterValue(value: string | string[] | undefined): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return typeof value === "string" && value.trim().length > 0;
}

export function FilterBar({
  fields,
  draftValues,
  onDraftChange,
  onApply,
  onReset,
  optionMap = {},
  applyLabel = "Apply",
  resetLabel = "Reset",
  isApplying = false,
}: FilterBarProps) {
  const { translate } = useLanguage();
  const hasCollapsible = fields.length > DESKTOP_VISIBLE_FILTER_COUNT;
  const primaryFields = fields.slice(0, DESKTOP_VISIBLE_FILTER_COUNT);
  const extraFields = fields.slice(DESKTOP_VISIBLE_FILTER_COUNT);

  const hasActiveExtraFilters = useMemo(
    () =>
      extraFields.some((field) => hasFilterValue(draftValues[field.key])),
    [draftValues, extraFields],
  );

  const [expanded, setExpanded] = useState(hasActiveExtraFilters);

  useEffect(() => {
    if (hasActiveExtraFilters) {
      setExpanded(true);
    }
  }, [hasActiveExtraFilters]);

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900",
        expanded && hasCollapsible && "overflow-visible",
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <FilterBarFields
            fields={primaryFields}
            values={draftValues}
            onChange={onDraftChange}
            optionMap={optionMap}
          />

          {hasCollapsible && (
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out",
                expanded
                  ? "mt-4 grid-rows-[1fr] overflow-visible opacity-100"
                  : "grid-rows-[0fr] overflow-hidden opacity-0",
              )}
            >
              <div
                className={cn(
                  "min-h-0",
                  expanded ? "overflow-visible" : "overflow-hidden",
                )}
              >
                <FilterBarFields
                  fields={extraFields}
                  values={draftValues}
                  onChange={onDraftChange}
                  optionMap={optionMap}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex w-full shrink-0 items-start gap-2 lg:w-auto">
          {hasCollapsible && (
            <Button
              type="button"
              variant="outline"
              size="md"
              className="h-[5.5rem] w-13 shrink-0 px-0"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded}
              aria-label={
                expanded ? translate("filterCollapse") : translate("filterExpand")
              }
            >
              <ChevronDown
                className={cn(
                  "h-9 w-9 transition-transform duration-300 ease-in-out",
                  expanded && "rotate-180",
                )}
                strokeWidth={2.5}
              />
            </Button>
          )}

          <div className="flex w-full flex-col gap-2 lg:w-36">
            <Button
              variant="primary"
              className="w-full"
              onClick={onApply}
              loading={isApplying}
            >
              {applyLabel}
            </Button>
            <Button variant="outline" className="w-full" onClick={onReset}>
              {resetLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
