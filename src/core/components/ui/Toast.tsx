import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn";

const EXIT_MS = 280;
export const DEFAULT_TOAST_DURATION_MS = 5_000;

export type ToastType = "success" | "error";

export interface ToastState {
  type: ToastType;
  message: string;
}

interface ToastProps {
  toast: ToastState | null;
  onDismiss: () => void;
  durationMs?: number;
}

const toastStyles = {
  success: {
    container:
      "border-emerald-300/70 bg-emerald-50 text-emerald-900 shadow-emerald-900/10 dark:border-emerald-700/50 dark:bg-emerald-950/90 dark:text-emerald-100",
    icon: "bg-emerald-600 text-white dark:bg-emerald-500",
    close:
      "text-emerald-700/70 hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-300/80 dark:hover:bg-emerald-900/60 dark:hover:text-emerald-100",
  },
  error: {
    container:
      "border-red-300/70 bg-red-50 text-red-900 shadow-red-900/10 dark:border-red-700/50 dark:bg-red-950/90 dark:text-red-100",
    icon: "bg-red-600 text-white dark:bg-red-500",
    close:
      "text-red-700/70 hover:bg-red-100 hover:text-red-900 dark:text-red-300/80 dark:hover:bg-red-900/60 dark:hover:text-red-100",
  },
} as const;

export function Toast({
  toast,
  onDismiss,
  durationMs = DEFAULT_TOAST_DURATION_MS,
}: ToastProps) {
  const [mounted, setMounted] = useState(toast !== null);
  const [visible, setVisible] = useState(false);
  const [content, setContent] = useState(toast);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef(onDismiss);
  const isShowingRef = useRef(toast !== null);

  onDismissRef.current = onDismiss;

  const clearTimers = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const beginExit = useCallback((notifyParent: boolean) => {
    isShowingRef.current = false;
    setVisible(false);

    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
    }

    exitTimerRef.current = setTimeout(() => {
      setMounted(false);
      if (notifyParent) {
        onDismissRef.current();
      }
    }, EXIT_MS);
  }, []);

  useEffect(() => {
    clearTimers();

    if (toast) {
      isShowingRef.current = true;
      setContent(toast);
      setMounted(true);

      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });

      dismissTimerRef.current = setTimeout(() => {
        beginExit(true);
      }, durationMs);

      return () => {
        cancelAnimationFrame(frame);
        clearTimers();
      };
    }

    if (isShowingRef.current) {
      beginExit(false);
    }

    return clearTimers;
  }, [toast, durationMs, clearTimers, beginExit]);

  if (!mounted || !content) {
    return null;
  }

  const isSuccess = content.type === "success";
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;
  const styles = isSuccess ? toastStyles.success : toastStyles.error;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 sm:pt-5"
      aria-live="polite"
    >
      <div
        role="alert"
        className={cn(
          "pointer-events-auto flex w-full max-w-[min(100%,28rem)] items-center gap-2.5 rounded-2xl border px-3.5 py-3 shadow-lg sm:gap-3 sm:px-4 sm:py-3.5",
          styles.container,
          visible
            ? "animate-[toast-enter_320ms_cubic-bezier(0.32,0.72,0,1)_forwards]"
            : "animate-[toast-exit_280ms_ease-in_forwards]",
        )}
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-full sm:h-8 sm:w-8",
            styles.icon,
          )}
        >
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
        </span>

        <p className="min-w-0 flex-1 self-center break-words text-[13px] leading-5 sm:text-sm sm:leading-6">
          {content.message}
        </p>

        <button
          type="button"
          onClick={() => beginExit(true)}
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-lg transition-colors sm:h-8 sm:w-8",
            styles.close,
          )}
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
