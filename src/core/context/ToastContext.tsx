import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Toast,
  DEFAULT_TOAST_DURATION_MS,
  type ToastState,
  type ToastType,
} from "../components/ui/Toast";

interface ShowToastOptions {
  type: ToastType;
  message: string;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (options: ShowToastOptions) => void;
  dismissToast: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [durationMs, setDurationMs] = useState(DEFAULT_TOAST_DURATION_MS);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const showToast = useCallback(
    ({ type, message, durationMs: nextDurationMs }: ShowToastOptions) => {
      setDurationMs(nextDurationMs ?? DEFAULT_TOAST_DURATION_MS);
      setToast({ type, message });
    },
    [],
  );

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast toast={toast} onDismiss={dismissToast} durationMs={durationMs} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
