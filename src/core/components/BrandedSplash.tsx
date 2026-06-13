import { useLanguage } from "../context/LanguageContext";
import { CourtlyLogo } from "./CourtlyLogo";

export function BrandedSplash() {
  const { translate } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFFFFF] px-8 dark:bg-[#FFFFFF]">
      <CourtlyLogo size={140} className="mb-8" />
      <h1 className="text-center text-3xl font-bold tracking-[0.2em] text-slate-900 sm:text-4xl">
        COURTLY
      </h1>
      <p className="mt-3 max-w-sm text-center text-sm font-medium text-slate-500 sm:text-base">
        {translate("appSubtitle")}
      </p>
    </div>
  );
}
