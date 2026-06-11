import type { ReactNode } from "react";
import { Package } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { GuestTopbar } from "./GuestTopbar";

interface GuestLayoutProps {
  children: ReactNode;
}

export function GuestLayout({ children }: GuestLayoutProps) {
  const { translate } = useLanguage();

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {translate("appName")}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {translate("appSubtitle")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-end p-5">
          <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500">
            &copy; {new Date().getFullYear()} {translate("appName")}
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
