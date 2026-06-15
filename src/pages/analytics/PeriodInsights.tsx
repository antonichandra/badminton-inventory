import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "../../core/utils/cn";
import { formatRupiah } from "../kasir/utils";
import {
  KasirTableShell,
  KasirTd,
  KasirTh,
  kasirTableClass,
  kasirTbodyClass,
  kasirTheadClass,
  kasirTrClass,
} from "../kasir/KasirTable";

export interface TopSellingProduct {
  productId: Id<"products">;
  productName: string;
  qty: number;
  unitPrice: number;
  revenue: number;
  grossProfit: number;
}

export interface GroupProductBreakdown {
  productId: Id<"products">;
  productName: string;
  qty: number;
  unitPrice: number;
  revenue: number;
}

export interface TopSpendingGroup {
  groupLabel: string;
  totalSpend: number;
  products: GroupProductBreakdown[];
}

interface PeriodInsightsProps {
  periodLabel: string;
  topProducts: TopSellingProduct[] | undefined;
  topGroups: TopSpendingGroup[] | undefined;
  labels: {
    topProductsTitle: string;
    topGroupsTitle: string;
    productName: string;
    price: string;
    profit: string;
    qty: string;
    spend: string;
    groupProducts: string;
    emptyProducts: string;
    emptyGroups: string;
  };
}

export function PeriodInsights({
  periodLabel,
  topProducts,
  topGroups,
  labels,
}: PeriodInsightsProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupLabel: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupLabel)) {
        next.delete(groupLabel);
      } else {
        next.add(groupLabel);
      }
      return next;
    });
  };

  const productsLoading = topProducts === undefined;
  const groupsLoading = topGroups === undefined;

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {labels.topProductsTitle}
          </h3>
          <p className="text-xs text-slate-500">{periodLabel}</p>
        </div>

        {productsLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        ) : topProducts.length === 0 ? (
          <p className="text-sm text-slate-500">{labels.emptyProducts}</p>
        ) : (
          <KasirTableShell>
            <table className={kasirTableClass}>
              <thead className={kasirTheadClass}>
                <tr>
                  <KasirTh>{labels.productName}</KasirTh>
                  <KasirTh>{labels.price}</KasirTh>
                  <KasirTh>{labels.profit}</KasirTh>
                  <KasirTh className="text-right">{labels.qty}</KasirTh>
                </tr>
              </thead>
              <tbody className={kasirTbodyClass}>
                {topProducts.map((product) => (
                  <tr key={product.productId} className={kasirTrClass}>
                    <KasirTd className="font-medium text-slate-900 dark:text-white">
                      {product.productName}
                    </KasirTd>
                    <KasirTd className="tabular-nums">
                      {formatRupiah(product.unitPrice)}
                    </KasirTd>
                    <KasirTd className="tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                      {formatRupiah(product.grossProfit)}
                    </KasirTd>
                    <KasirTd className="text-right tabular-nums font-semibold">
                      {product.qty}
                    </KasirTd>
                  </tr>
                ))}
              </tbody>
            </table>
          </KasirTableShell>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {labels.topGroupsTitle}
          </h3>
          <p className="text-xs text-slate-500">{periodLabel}</p>
        </div>

        {groupsLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        ) : topGroups.length === 0 ? (
          <p className="text-sm text-slate-500">{labels.emptyGroups}</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {topGroups.map((group) => {
              const expanded = expandedGroups.has(group.groupLabel);

              return (
                <li key={group.groupLabel}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.groupLabel)}
                    aria-expanded={expanded}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ease-in-out",
                          expanded && "rotate-180",
                        )}
                      />
                      <span className="truncate font-medium text-slate-900 dark:text-white">
                        {group.groupLabel}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                      {formatRupiah(group.totalSpend)}
                    </span>
                  </button>

                  <div
                    className={cn(
                      "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                      expanded
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="mb-3 ml-6 rounded-lg border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                          {labels.groupProducts}
                        </p>
                        <ul className="space-y-2">
                          {group.products.map((product) => (
                            <li
                              key={product.productId}
                              className="flex items-start justify-between gap-3 text-sm"
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 dark:text-white">
                                  {product.productName}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {product.qty} × {formatRupiah(product.unitPrice)}
                                </p>
                              </div>
                              <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-400">
                                {formatRupiah(product.revenue)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
