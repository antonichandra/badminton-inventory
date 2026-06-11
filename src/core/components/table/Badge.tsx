import { cn } from "../../utils/cn";
import type { BadgeVariant } from "./types";

const variantClasses: Record<BadgeVariant, string> = {
  default:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  success:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  warning:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  danger: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
};

interface BadgeProps {
  children: string;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
