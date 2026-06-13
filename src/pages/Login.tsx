import { type CredentialResponse } from "@react-oauth/google";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandedSplash } from "../core/components/BrandedSplash";
import { CourtlyLogo } from "../core/components/CourtlyLogo";
import { GoogleSignInButton } from "../core/components/GoogleSignInButton";
import { useAuth } from "../core/context/AuthContext";
import { useLanguage } from "../core/context/LanguageContext";
import { useToast } from "../core/context/ToastContext";
import { useRequireAuth } from "../core/hooks/useRequireAuth";
import { navigateWithTransition } from "../core/utils/viewTransition";

export function LoginPage() {
  const { login } = useAuth();
  const { translate } = useLanguage();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { isLoading: authLoading } = useRequireAuth("guest");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) {
      showToast({ type: "error", message: translate("errorAuth") });
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await login(response.credential);

      if (session.user.status === "APPROVED") {
        await navigateWithTransition(navigate, "/dashboard");
      } else {
        await navigateWithTransition(navigate, "/waiting-approval");
      }
    } catch (err) {
      console.error("Login failed:", err);
      showToast({
        type: "error",
        message:
          err instanceof Error && err.message
            ? err.message
            : translate("errorAuth"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return <BrandedSplash />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-6 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 text-center">
            <CourtlyLogo size={64} className="mx-auto mb-4" />
            <h1 className="text-xl font-bold tracking-[0.18em] text-slate-900 dark:text-white">
              COURTLY
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {translate("appSubtitle")}
            </p>
          </div>

          <div className="mb-6 flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {translate("loginTitle")}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {translate("loginSubtitle")}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <GoogleSignInButton
              onSuccess={handleGoogleSuccess}
              onError={() =>
                showToast({ type: "error", message: translate("errorAuth") })
              }
              loading={isSubmitting}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
