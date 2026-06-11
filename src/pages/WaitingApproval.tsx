import { Clock, Loader2, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../core/components/ui/Button";
import { useAuth } from "../core/context/AuthContext";
import { useLanguage } from "../core/context/LanguageContext";
import { useRequireAuth } from "../core/hooks/useRequireAuth";
import { navigateWithTransition } from "../core/utils/viewTransition";

export function WaitingApprovalPage() {
  const { user, logout } = useAuth();
  const { translate } = useLanguage();
  const navigate = useNavigate();
  const { isLoading } = useRequireAuth("pending");

  const handleLogout = async () => {
    await logout();
    await navigateWithTransition(navigate, "/login");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-6 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-start gap-3 sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white sm:h-11 sm:w-11">
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900 sm:text-xl dark:text-white">
                {translate("waitingTitle")}
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {translate("waitingSubtitle")}
              </p>
            </div>
          </div>

          <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {translate("waitingEmail")}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
              {user?.email}
            </p>
          </div>

          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
            {translate("waitingHint")}
          </p>

          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => void handleLogout()}
            leftIcon={<LogOut className="h-4 w-4" />}
          >
            {translate("waitingLogout")}
          </Button>
        </div>
      </div>
    </div>
  );
}
