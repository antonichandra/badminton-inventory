import { AlertTriangle, Home } from "lucide-react";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";
import { Button } from "../core/components/ui/Button";
import { useLanguage } from "../core/context/LanguageContext";
import { navigateWithTransition } from "../core/utils/viewTransition";

function getErrorMessage(error: unknown): string | null {
  if (import.meta.env.DEV) {
    if (isRouteErrorResponse(error)) {
      return error.statusText || error.data?.toString() || null;
    }
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
  }
  return null;
}

interface UnexpectedErrorContentProps {
  devMessage?: string | null;
}

export function UnexpectedErrorContent({
  devMessage = null,
}: UnexpectedErrorContentProps) {
  const { translate } = useLanguage();
  const navigate = useNavigate();

  const handleBackHome = () => {
    void navigateWithTransition(navigate, "/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-50 text-red-500 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900/50">
          <AlertTriangle className="h-14 w-14" strokeWidth={1.75} />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {translate("unexpectedErrorTitle")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {translate("unexpectedErrorDescription")}
        </p>

        {devMessage && (
          <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-left font-mono text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            {devMessage}
          </p>
        )}

        <Button
          className="mt-8"
          leftIcon={<Home className="h-4 w-4" />}
          onClick={handleBackHome}
        >
          {translate("unexpectedErrorBackHome")}
        </Button>
      </div>
    </div>
  );
}

export function UnexpectedErrorPage() {
  const routeError = useRouteError();
  return <UnexpectedErrorContent devMessage={getErrorMessage(routeError)} />;
}
