import { X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn";

const ANIMATION_MS = 320;

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: BottomSheetProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close panel"
        className={cn(
          "absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]",
          visible
            ? "animate-[backdrop-fade-in_320ms_ease-out_forwards]"
            : "animate-[backdrop-fade-out_320ms_ease-in_forwards]",
        )}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative z-10 flex max-h-[88svh] w-full max-w-lg flex-col rounded-t-[1.25rem] border border-slate-200/80 bg-white shadow-[0_-8px_40px_-12px_rgba(15,23,42,0.25)] dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.5)]",
          visible
            ? "animate-[bottom-sheet-enter_320ms_cubic-bezier(0.32,0.72,0,1)_forwards]"
            : "animate-[bottom-sheet-exit_280ms_cubic-bezier(0.32,0.72,0,1)_forwards]",
        )}
      >
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>

        <div className="flex items-center justify-between border-b border-slate-100 px-5 pb-3 dark:border-slate-800">
          <h2
            id={titleId}
            className="text-base font-semibold tracking-tight text-slate-900 dark:text-white"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>

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
