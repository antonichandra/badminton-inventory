import type { LucideIcon } from "lucide-react";
import { Skeleton } from "./Skeleton";
import { cn } from "../../utils/cn";

export interface MetricCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  iconClassName?: string;
  delta?: {
    text: string;
    tone?: "positive" | "negative" | "neutral";
  };
  loading?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  iconClassName = "bg-emerald-500 text-white",
  delta,
  loading = false,
  className,
}: MetricCardProps) {
  if (loading) {
    return (
      <div
        className={cn(
          "rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900",
          className,
        )}
      >
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-7 w-32" />
        <Skeleton className="mt-2 h-3 w-20" />
      </div>
    );
  }

  const deltaClass =
    delta?.tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : delta?.tone === "negative"
        ? "text-red-600 dark:text-red-400"
        : "text-slate-500 dark:text-slate-400";

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </p>
        {Icon && (
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              iconClassName,
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
        {value}
      </p>
      {delta && (
        <p className={cn("mt-1 text-xs font-medium", deltaClass)}>{delta.text}</p>
      )}
    </div>
  );
}
