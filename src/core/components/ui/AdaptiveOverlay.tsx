import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigationLayout } from "../../hooks/useNavigationLayout";
import { useSheetDragToClose } from "../../hooks/useSheetDragToClose";
import { cn } from "../../utils/cn";

const ANIMATION_MS = 320;

type OverlaySize = "sm" | "md" | "lg";

export interface AdaptiveOverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: OverlaySize;
  /** Reserve space at the bottom when rendered as a sheet (e.g. sticky pay bar). */
  bottomInset?: string;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  /** Allow swipe-down dismiss on sheet variant (default true). */
  dismissOnDrag?: boolean;
}

const sizeClasses: Record<OverlaySize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export function AdaptiveOverlay({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  bottomInset,
  closeOnBackdrop = true,
  showCloseButton = true,
  dismissOnDrag = true,
}: AdaptiveOverlayProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const layout = useNavigationLayout();
  const variant = layout === "bottom" ? "sheet" : "modal";
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  const sheetDrag = useSheetDragToClose({
    enabled: variant === "sheet" && dismissOnDrag,
    open,
    onClose,
    panelRef,
  });

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mounted, onClose]);

  if (!mounted) {
    return null;
  }

  const backdropClass = cn(
    "absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]",
    visible
      ? "animate-[backdrop-fade-in_320ms_ease-out_forwards]"
      : "animate-[backdrop-fade-out_320ms_ease-in_forwards]",
  );

  const handleBackdropClick = closeOnBackdrop ? onClose : undefined;

  if (variant === "sheet") {
    const suppressCssAnimation =
      sheetDrag.isDragging ||
      sheetDrag.isAnimating ||
      sheetDrag.dragOffset > 0;

    return createPortal(
      <div
        className="fixed inset-0 z-[65] flex items-end justify-center"
        style={bottomInset ? { paddingBottom: bottomInset } : undefined}
      >
        <button
          type="button"
          aria-label="Close panel"
          data-overlay-backdrop
          className={cn(
            backdropClass,
            (sheetDrag.isDragging || sheetDrag.isAnimating) &&
              "animate-none!",
          )}
          style={
            sheetDrag.backdropOpacity !== undefined
              ? { opacity: sheetDrag.backdropOpacity }
              : undefined
          }
          onClick={handleBackdropClick}
        />

        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          data-overlay-panel
          style={sheetDrag.panelStyle}
          className={cn(
            "relative z-10 flex max-h-[88svh] w-full max-w-lg flex-col rounded-t-[1.25rem] border border-slate-200/80 bg-white shadow-[0_-8px_40px_-12px_rgba(15,23,42,0.25)] dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.5)]",
            sheetDrag.isDragging && "sheet-dragging",
            sheetDrag.isAnimating && "sheet-snap-back",
            !suppressCssAnimation &&
              (visible
                ? "animate-[bottom-sheet-enter_320ms_cubic-bezier(0.32,0.72,0,1)_forwards]"
                : "animate-[bottom-sheet-exit_280ms_cubic-bezier(0.32,0.72,0,1)_forwards]"),
          )}
        >
          <div
            className={cn(
              "shrink-0 touch-none select-none",
              sheetDrag.dragEnabled && "cursor-grab active:cursor-grabbing",
            )}
            {...sheetDrag.dragZoneProps}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 px-5 pb-3 dark:border-slate-800">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="text-base font-semibold tracking-tight text-slate-900 dark:text-white"
                >
                  {title}
                </h2>
                {description && (
                  <p
                    id={descriptionId}
                    className="mt-1 text-sm text-slate-500 dark:text-slate-400"
                  >
                    {description}
                  </p>
                )}
              </div>
              {showCloseButton && (
                <button
                  type="button"
                  data-sheet-close
                  onClick={onClose}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {children && (
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {children}
            </div>
          )}

          {footer && (
            <div className="shrink-0 border-t border-slate-100 bg-white/95 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_-8px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.4)]">
              {footer}
            </div>
          )}
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal"
        data-overlay-backdrop
        className={backdropClass}
        onClick={handleBackdropClick}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        data-overlay-panel
        className={cn(
          "relative z-10 w-full rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900",
          sizeClasses[size],
          visible
            ? "animate-[modal-enter_320ms_cubic-bezier(0.32,0.72,0,1)_forwards]"
            : "animate-[modal-exit_280ms_cubic-bezier(0.32,0.72,0,1)_forwards]",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="mt-1 text-sm text-slate-500 dark:text-slate-400"
              >
                {description}
              </p>
            )}
          </div>

          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {children && <div className="px-5 py-4">{children}</div>}

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
