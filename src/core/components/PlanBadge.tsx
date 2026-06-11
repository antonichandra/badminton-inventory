import { Crown, Gem, Sparkles, Zap } from "lucide-react";
import { cn } from "../utils/cn";

export type PlanTier = "enterprise" | "growth" | "starter" | "default";

export function getPlanTier(planName: string | null | undefined): PlanTier {
  const normalized = planName?.trim().toLowerCase() ?? "";

  if (normalized.includes("enterprise")) return "enterprise";
  if (normalized.includes("growth")) return "growth";
  if (normalized.includes("starter")) return "starter";
  return "default";
}

const tierStyles: Record<
  PlanTier,
  { className: string; icon: typeof Crown }
> = {
  enterprise: {
    className:
      "bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 text-amber-950 shadow-md shadow-amber-500/25 ring-1 ring-amber-300/60 dark:from-amber-600 dark:via-yellow-400 dark:to-amber-600 dark:text-amber-950 dark:ring-amber-400/40",
    icon: Crown,
  },
  growth: {
    className:
      "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm shadow-violet-500/20 ring-1 ring-violet-400/30 dark:from-violet-500 dark:to-indigo-500",
    icon: Gem,
  },
  starter: {
    className:
      "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/50",
    icon: Zap,
  },
  default: {
    className:
      "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    icon: Sparkles,
  },
};

interface PlanBadgeProps {
  planName: string;
  className?: string;
}

export function PlanBadge({ planName, className }: PlanBadgeProps) {
  const tier = getPlanTier(planName);
  const styles = tierStyles[tier];
  const Icon = styles.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        styles.className,
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      <span>{planName}</span>
    </span>
  );
}
