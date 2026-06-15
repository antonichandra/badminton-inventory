import { useLanguage } from "../../context/LanguageContext";
import { cn } from "../../utils/cn";
import { Spinner } from "./Spinner";

type LoadingVariant = "inline" | "page" | "sheet";

interface LoadingStateProps {
  label?: string;
  variant?: LoadingVariant;
  className?: string;
}

const variantClasses: Record<LoadingVariant, string> = {
  inline: "inline-flex items-center gap-2.5",
  page: "flex flex-col items-center justify-center gap-3 py-12 text-center",
  sheet: "flex min-h-[8rem] flex-col items-center justify-center gap-3 py-6 text-center",
};

export function LoadingState({
  label,
  variant = "inline",
  className,
}: LoadingStateProps) {
  const { translate } = useLanguage();
  const message = label ?? translate("loading");

  return (
    <div
      role="status"
      className={cn(variantClasses[variant], className)}
    >
      <Spinner size={variant === "inline" ? "sm" : "md"} />
      <span className="text-sm text-slate-500 dark:text-slate-400">
        {message}
      </span>
    </div>
  );
}
