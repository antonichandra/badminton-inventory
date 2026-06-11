import { PlanBadge } from "../PlanBadge";
import { SportBadge } from "../SportBadge";
import { cn } from "../../utils/cn";
import type { SelectOption } from "./types";

interface SelectOptionContentProps {
  option: SelectOption;
  compact?: boolean;
  className?: string;
}

export function SelectOptionContent({
  option,
  compact = false,
  className,
}: SelectOptionContentProps) {
  if (option.sportSlug || option.variant === "sport") {
    return (
      <div className={cn("flex min-w-0 items-center gap-2", className)}>
        <SportBadge
          slug={option.sportSlug ?? ""}
          name={option.label}
          size={compact ? "sm" : "md"}
        />
        <span className="truncate text-sm">{option.label}</span>
      </div>
    );
  }

  if (option.planName !== undefined || option.variant === "plan") {
    return (
      <PlanBadge
        planName={option.planName ?? option.label}
        className={cn(compact && "px-2 py-0.5 text-[10px]", className)}
      />
    );
  }

  if (option.description || option.variant === "business") {
    return (
      <div className={cn("min-w-0", className)}>
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
          {option.label}
        </p>
        {option.description && (
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {option.description}
          </p>
        )}
      </div>
    );
  }

  return (
    <span className={cn("truncate text-sm", className)}>{option.label}</span>
  );
}

export function optionMatchesSearch(option: SelectOption, term: string): boolean {
  const normalized = term.toLowerCase();
  return (
    option.label.toLowerCase().includes(normalized) ||
    (option.description?.toLowerCase().includes(normalized) ?? false)
  );
}

export function isRichSelectOption(option: SelectOption): boolean {
  return Boolean(
    option.sportSlug ||
      option.planName !== undefined ||
      option.variant ||
      option.description,
  );
}
