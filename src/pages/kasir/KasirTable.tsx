import type { ReactNode } from "react";
import { cn } from "../../core/utils/cn";
import {
  compactTableClass,
  compactTbodyClass,
  compactTdClass,
  compactTheadClass,
  compactThClass,
  compactTrClass,
} from "../../core/components/categoryGroup/styles";

export function KasirTableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export const kasirTableClass =
  "min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800";

export const kasirTheadClass = "bg-slate-50 dark:bg-slate-800/50";

export const kasirThClass =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";

export const kasirTbodyClass =
  "divide-y divide-slate-100 dark:divide-slate-800";

export const kasirTrClass =
  "transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40";

export const kasirTdClass =
  "px-4 py-3 align-middle text-sm text-slate-700 dark:text-slate-300";

export {
  compactTableClass as kasirCompactTableClass,
  compactTheadClass as kasirCompactTheadClass,
  compactTbodyClass as kasirCompactTbodyClass,
  compactTrClass as kasirCompactTrClass,
  compactThClass as kasirCompactThClass,
  compactTdClass as kasirCompactTdClass,
};

export function KasirTh({
  className,
  children,
  compact = false,
}: {
  className?: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <th className={cn(compact ? compactThClass : kasirThClass, className)}>
      {children}
    </th>
  );
}

export function KasirTd({
  className,
  children,
  compact = false,
}: {
  className?: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <td className={cn(compact ? compactTdClass : kasirTdClass, className)}>
      {children}
    </td>
  );
}
