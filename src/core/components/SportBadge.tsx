import { cn } from "../utils/cn";

const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸",
  futsal: "⚽",
  basket: "🏀",
  tenis: "🎾",
  voli: "🏐",
};

interface SportBadgeProps {
  slug: string;
  name: string;
  size?: "sm" | "md";
  className?: string;
}

export function SportBadge({
  slug,
  name,
  size = "sm",
  className,
}: SportBadgeProps) {
  const emoji = SPORT_EMOJI[slug] ?? "🏟️";

  return (
    <span
      title={name}
      aria-label={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700",
        size === "sm" ? "h-6 w-6 text-sm" : "h-7 w-7 text-base",
        className,
      )}
    >
      {emoji}
    </span>
  );
}
