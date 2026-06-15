import { cn } from "../../utils/cn";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      data-skeleton
      aria-hidden="true"
      className={cn(
        "rounded-md bg-slate-200/80 animate-pulse dark:bg-slate-700/50",
        className,
      )}
    />
  );
}
