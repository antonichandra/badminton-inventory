import { Loader2 } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export function LoadingScreen() {
  const { translate } = useLanguage();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {translate("loading")}
        </p>
      </div>
    </div>
  );
}
