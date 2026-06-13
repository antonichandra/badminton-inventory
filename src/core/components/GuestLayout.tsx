import type { ReactNode } from "react";
import { useLanguage } from "../context/LanguageContext";
import { CourtlyLogo } from "./CourtlyLogo";
import { GuestTopbar } from "./GuestTopbar";

interface GuestLayoutProps {
  children: ReactNode;
}

export function GuestLayout({ children }: GuestLayoutProps) {
  const { translate } = useLanguage();

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-[#F1F5F9] dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="border-b border-slate-200 px-5 py-6 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <CourtlyLogo size={40} />
            <div>
              <p className="text-sm font-bold tracking-[0.12em] text-slate-900 dark:text-white">
                COURTLY
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {translate("appSubtitle")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-end p-5">
          <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500">
            &copy; {new Date().getFullYear()} Courtly
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <GuestTopbar />
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="page-content w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
