import type { ReactNode } from "react";
import { LoadingState } from "./ui/LoadingState";
import { useBusiness } from "../context/BusinessContext";
import { useLanguage } from "../context/LanguageContext";

interface BusinessScopeGateProps {
  children: ReactNode;
}

export function BusinessScopeGate({ children }: BusinessScopeGateProps) {
  const { translate } = useLanguage();
  const { activeBusinessId, isLoading } = useBusiness();

  if (isLoading) {
    return <LoadingState variant="page" className="py-8" />;
  }

  if (!activeBusinessId) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <p className="text-slate-500 dark:text-slate-400">
          {translate("kasirNoBusiness")}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
