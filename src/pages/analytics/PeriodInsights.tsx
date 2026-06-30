import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import { resolveSpendingGroupLabel } from "../../core/constants/spendingGroups";
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
  unit: string;
  qty: number;
  unitPrice: number;
  revenue: number;
  grossProfit: number;
}

export interface TopSellingCategory {
  categoryId?: Id<"productCategories">;
  categoryName: string;
  qty: number;
  revenue: number;
  grossProfit: number;
}

export interface GroupProductBreakdown {
  productId: Id<"products">;
  productName: string;
  unit: string;
  qty: number;
  unitPrice: number;
  revenue: number;
}

export interface GroupCategoryBreakdown {
  categoryId?: Id<"productCategories">;
  categoryName: string;
  qty: number;
  unitPrice: number;
  revenue: number;
}

export interface TopSpendingGroup {
  groupLabel: string;
  totalSpend: number;
  products: GroupProductBreakdown[];
  categories: GroupCategoryBreakdown[];
}

type GroupBreakdownMode = "product" | "category";

interface PeriodInsightsProps {
  periodLabel: string;
  topProducts: TopSellingProduct[] | undefined;
  topCategories: TopSellingCategory[] | undefined;
  topGroups: TopSpendingGroup[] | undefined;
  labels: {
    topProductsTitle: string;
    topCategoriesTitle: string;
    topGroupsTitle: string;
    productName: string;
    categoryName: string;
    price: string;
    profit: string;
    qty: string;
    spend: string;
    groupProducts: string;
    breakdownByProduct: string;
    breakdownByCategory: string;
    emptyProducts: string;
    emptyCategories: string;
    emptyGroups: string;
    ungroupedGroup: string;
    missInputGroup: string;
    soldLabel: string;
  };
}

function formatQtyLine(
  qty: number,
  unit: string | undefined,
  soldLabel: string,
): string {
  const trimmedUnit = unit?.trim();
  if (trimmedUnit) {
    return `${qty} ${trimmedUnit}`;
  }
  return `${qty} ${soldLabel}`;
}

export function PeriodInsights({
  periodLabel,
  topProducts,
  topCategories,
  topGroups,
  labels,
}: PeriodInsightsProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [breakdownMode, setBreakdownMode] =
    useState<GroupBreakdownMode>("product");

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
  const categoriesLoading = topCategories === undefined;
  const groupsLoading = topGroups === undefined;

  return (
    <div className="mb-6 grid min-w-0 gap-4 lg:grid-cols-3">
      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {labels.topProductsTitle}
          </h3>
          <p className="text-xs leading-relaxed text-slate-500">{periodLabel}</p>
        </div>

        {productsLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        ) : topProducts.length === 0 ? (
          <p className="text-sm text-slate-500">{labels.emptyProducts}</p>
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <KasirTableShell>
              <table className={kasirTableClass}>
                <thead className={kasirTheadClass}>
                  <tr>
                    <KasirTh className="whitespace-nowrap">{labels.productName}</KasirTh>
                    <KasirTh className="whitespace-nowrap">{labels.price}</KasirTh>
                    <KasirTh className="whitespace-nowrap">{labels.profit}</KasirTh>
                  </tr>
                </thead>
                <tbody className={kasirTbodyClass}>
                  {topProducts.map((product) => (
                    <tr key={product.productId} className={kasirTrClass}>
                      <KasirTd>
                        <p className="whitespace-nowrap font-medium text-slate-900 dark:text-white">
                          {product.productName}
                        </p>
                        <p className="mt-0.5 whitespace-nowrap text-xs tabular-nums text-slate-500">
                          {formatQtyLine(
                            product.qty,
                            product.unit,
                            labels.soldLabel,
                          )}
                        </p>
                      </KasirTd>
                      <KasirTd className="whitespace-nowrap tabular-nums">
                        {formatRupiah(product.unitPrice)}
                      </KasirTd>
                      <KasirTd className="whitespace-nowrap tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                        {formatRupiah(product.grossProfit)}
                      </KasirTd>
                    </tr>
                  ))}
                </tbody>
              </table>
            </KasirTableShell>
          </div>
        )}
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {labels.topCategoriesTitle}
          </h3>
          <p className="text-xs leading-relaxed text-slate-500">{periodLabel}</p>
        </div>

        {categoriesLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        ) : topCategories.length === 0 ? (
          <p className="text-sm text-slate-500">{labels.emptyCategories}</p>
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <KasirTableShell>
              <table className={kasirTableClass}>
                <thead className={kasirTheadClass}>
                  <tr>
                    <KasirTh className="whitespace-nowrap">{labels.categoryName}</KasirTh>
                    <KasirTh className="whitespace-nowrap">{labels.profit}</KasirTh>
                    <KasirTh className="whitespace-nowrap text-right">{labels.qty}</KasirTh>
                  </tr>
                </thead>
                <tbody className={kasirTbodyClass}>
                  {topCategories.map((category) => (
                    <tr
                      key={category.categoryId ?? category.categoryName}
                      className={kasirTrClass}
                    >
                      <KasirTd className="whitespace-nowrap font-medium text-slate-900 dark:text-white">
                        {category.categoryName}
                      </KasirTd>
                      <KasirTd className="whitespace-nowrap tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                        {formatRupiah(category.grossProfit)}
                      </KasirTd>
                      <KasirTd className="whitespace-nowrap text-right tabular-nums font-semibold">
                        {formatQtyLine(category.qty, undefined, labels.soldLabel)}
                      </KasirTd>
                    </tr>
                  ))}
                </tbody>
              </table>
            </KasirTableShell>
          </div>
        )}
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-1">
        <div className="mb-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 truncate font-semibold text-slate-900 dark:text-white">
              {labels.topGroupsTitle}
            </h3>
            {!groupsLoading && topGroups.length > 0 && (
              <div className="flex shrink-0 rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setBreakdownMode("product")}
                  className={cn(
                    "whitespace-nowrap rounded-md px-2 py-1 font-medium transition-colors",
                    breakdownMode === "product"
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "text-slate-500",
                  )}
                >
                  {labels.breakdownByProduct}
                </button>
                <button
                  type="button"
                  onClick={() => setBreakdownMode("category")}
                  className={cn(
                    "whitespace-nowrap rounded-md px-2 py-1 font-medium transition-colors",
                    breakdownMode === "category"
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "text-slate-500",
                  )}
                >
                  {labels.breakdownByCategory}
                </button>
              </div>
            )}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            {periodLabel}
          </p>
        </div>

        {groupsLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        ) : topGroups.length === 0 ? (
          <p className="text-sm text-slate-500">{labels.emptyGroups}</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {topGroups.map((group) => {
              const displayLabel = resolveSpendingGroupLabel(group.groupLabel, {
                ungrouped: labels.ungroupedGroup,
                missInput: labels.missInputGroup,
              });
              const expanded = expandedGroups.has(group.groupLabel);
              const breakdownItems =
                breakdownMode === "product"
                  ? group.products.map((item) => ({
                      key: item.productId,
                      name: item.productName,
                      qty: item.qty,
                      unit: item.unit,
                      unitPrice: item.unitPrice,
                      revenue: item.revenue,
                    }))
                  : group.categories.map((item) => ({
                      key: item.categoryId ?? item.categoryName,
                      name: item.categoryName,
                      qty: item.qty,
                      unit: undefined,
                      unitPrice: item.unitPrice,
                      revenue: item.revenue,
                    }));

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
                        {displayLabel}
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
                          {breakdownMode === "product"
                            ? labels.groupProducts
                            : labels.categoryName}
                        </p>
                        <ul className="space-y-2">
                          {breakdownItems.map((item) => (
                            <li
                              key={item.key}
                              className="flex items-start justify-between gap-3 text-sm"
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 dark:text-white">
                                  {item.name}
                                </p>
                                {breakdownMode === "product" && (
                                  <p className="text-xs text-slate-500">
                                    {formatQtyLine(
                                      item.qty,
                                      item.unit,
                                      labels.soldLabel,
                                    )}{" "}
                                    × {formatRupiah(item.unitPrice)}
                                  </p>
                                )}
                              </div>
                              <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-400">
                                {formatRupiah(item.revenue)}
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
