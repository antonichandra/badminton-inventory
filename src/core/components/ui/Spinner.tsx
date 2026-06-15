import { cn } from "../../utils/cn";

type SpinnerSize = "sm" | "md" | "lg";

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-[1.5px]",
  md: "h-5 w-5 border-2",
  lg: "h-8 w-8 border-2",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-hidden="true"
      className={cn(
        "inline-block animate-spin rounded-full border-emerald-600 border-t-transparent dark:border-emerald-400",
        sizeClasses[size],
        className,
      )}
    />
  );
}
