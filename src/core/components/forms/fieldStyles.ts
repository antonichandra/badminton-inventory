import { cn } from "../../utils/cn";

export const fieldBaseClass = cn(
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900",
  "placeholder:text-slate-400 transition-colors duration-150",
  "focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
  "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
  "dark:placeholder:text-slate-500 dark:disabled:bg-slate-800",
);

export const fieldErrorClass =
  "border-red-300 focus:border-red-500 focus:ring-red-500/20 dark:border-red-800";
