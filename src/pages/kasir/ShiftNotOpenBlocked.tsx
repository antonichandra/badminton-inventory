import { Clock } from "lucide-react";
import { useLanguage } from "../../core/context/LanguageContext";

export function ShiftNotOpenBlocked() {
  const { translate } = useLanguage();

  return (
    <div className="mx-auto max-w-md rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
        <Clock className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
        {translate("kasirShiftNotOpenTitle")}
      </h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {translate("kasirShiftNotOpenDesc")}
      </p>
    </div>
  );
}
