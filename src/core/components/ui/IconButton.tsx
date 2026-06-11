import {
  useCallback,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn";

type IconButtonVariant = "default" | "success" | "danger" | "ghost";
type TooltipPlacement = "top" | "bottom" | "left" | "right";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  tooltip: string;
  loading?: boolean;
  variant?: IconButtonVariant;
  tooltipPlacement?: TooltipPlacement;
}

const variantClasses: Record<IconButtonVariant, string> = {
  default:
    "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
  success:
    "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300",
  danger:
    "text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300",
  ghost:
    "text-slate-400 hover:bg-transparent hover:text-slate-600 dark:hover:text-slate-300",
};

function getTooltipStyle(
  rect: DOMRect,
  placement: TooltipPlacement,
): CSSProperties {
  const gap = 8;

  switch (placement) {
    case "bottom":
      return {
        top: rect.bottom + gap,
        left: rect.left + rect.width / 2,
        transform: "translateX(-50%)",
      };
    case "left":
      return {
        top: rect.top + rect.height / 2,
        left: rect.left - gap,
        transform: "translate(-100%, -50%)",
      };
    case "right":
      return {
        top: rect.top + rect.height / 2,
        left: rect.right + gap,
        transform: "translateY(-50%)",
      };
    case "top":
    default:
      return {
        top: rect.top - gap,
        left: rect.left + rect.width / 2,
        transform: "translate(-50%, -100%)",
      };
  }
}

export function IconButton({
  icon,
  tooltip,
  loading = false,
  variant = "default",
  tooltipPlacement = "top",
  className = "",
  disabled,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ...props
}: IconButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({});

  const updateTooltipPosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltipStyle(getTooltipStyle(rect, tooltipPlacement));
  }, [tooltipPlacement]);

  const showTooltip = useCallback(() => {
    updateTooltipPosition();
    setTooltipVisible(true);
  }, [updateTooltipPosition]);

  const hideTooltip = useCallback(() => {
    setTooltipVisible(false);
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={tooltip}
        disabled={disabled || loading}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          variantClasses[variant],
          className,
        )}
        onMouseEnter={(event) => {
          showTooltip();
          onMouseEnter?.(event);
        }}
        onMouseLeave={(event) => {
          hideTooltip();
          onMouseLeave?.(event);
        }}
        onFocus={(event) => {
          showTooltip();
          onFocus?.(event);
        }}
        onBlur={(event) => {
          hideTooltip();
          onBlur?.(event);
        }}
        {...props}
      >
        {icon}
      </button>

      {tooltipVisible &&
        createPortal(
          <span
            role="tooltip"
            style={tooltipStyle}
            className="pointer-events-none fixed z-40 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg dark:bg-slate-700"
          >
            {tooltip}
          </span>,
          document.body,
        )}
    </>
  );
}
