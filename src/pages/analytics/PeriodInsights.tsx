import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import { Modal } from "../../core/components/ui/Modal";
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

export type ProductSortBy = "qty" | "revenue" | "grossProfit";

interface PeriodInsightsProps {
  periodLabel: string;
  topProducts: TopSellingProduct[] | undefined;
  allProducts: TopSellingProduct[] | undefined;
  showAllProducts: boolean;
  onShowAllProductsChange: (open: boolean) => void;
  productSortBy: ProductSortBy;
  onProductSortByChange: (sortBy: ProductSortBy) => void;
  topCategories: TopSellingCategory[] | undefined;
  topGroups: TopSpendingGroup[] | undefined;
  labels: {
    topProductsTitle: string;
    topProductsShowAll: string;
    topProductsAllTitle: string;
    sortByQty: string;
    sortByRevenue: string;
    sortByProfit: string;
    topCategoriesTitle: string;
    topGroupsTitle: string;
    productName: string;
    categoryName: string;
    revenue: string;
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

function formatProfitDelta(grossProfit: number): string {
  const absolute = formatRupiah(Math.abs(grossProfit));
  if (grossProfit > 0) return `+${absolute}`;
  if (grossProfit < 0) return `−${absolute}`;
  return absolute;
}

function ProductSalesTable({
  products,
  labels,
}: {
  products: TopSellingProduct[];
  labels: Pick<
    PeriodInsightsProps["labels"],
    "productName" | "revenue" | "soldLabel"
  >;
}) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <KasirTableShell>
        <table className={kasirTableClass}>
          <thead className={kasirTheadClass}>
            <tr>
              <KasirTh className="whitespace-nowrap">{labels.productName}</KasirTh>
              <KasirTh className="whitespace-nowrap text-right">
                {labels.revenue}
              </KasirTh>
            </tr>
          </thead>
          <tbody className={kasirTbodyClass}>
            {products.map((product) => (
              <tr key={product.productId} className={kasirTrClass}>
                <KasirTd>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {product.productName}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                    {formatQtyLine(
                      product.qty,
                      product.unit,
                      labels.soldLabel,
                    )}{" "}
                    × {formatRupiah(product.unitPrice)}
                  </p>
                </KasirTd>
                <KasirTd className="text-right">
                  <p className="whitespace-nowrap tabular-nums font-medium text-slate-900 dark:text-white">
                    {formatRupiah(product.revenue)}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 whitespace-nowrap text-xs tabular-nums font-medium",
                      product.grossProfit >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {formatProfitDelta(product.grossProfit)}
                  </p>
                </KasirTd>
              </tr>
            ))}
          </tbody>
        </table>
      </KasirTableShell>
    </div>
  );
}

export function PeriodInsights({
  periodLabel,
  topProducts,
  allProducts,
  showAllProducts,
  onShowAllProductsChange,
  productSortBy,
  onProductSortByChange,
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
  const canShowAll = !productsLoading && topProducts.length > 0;

  const sortOptions: Array<{ key: ProductSortBy; label: string }> = [
    { key: "qty", label: labels.sortByQty },
    { key: "revenue", label: labels.sortByRevenue },
    { key: "grossProfit", label: labels.sortByProfit },
  ];

  const sortControl = (
    <div className="flex w-fit max-w-full rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-700">
      {sortOptions.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onProductSortByChange(option.key)}
          className={cn(
            "whitespace-nowrap rounded-md px-2 py-1 font-medium transition-colors",
            productSortBy === option.key
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "text-slate-500",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="mb-6 grid min-w-0 gap-4 lg:grid-cols-3">
        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {labels.topProductsTitle}
                </h3>
                <p className="text-xs leading-relaxed text-slate-500">
                  {periodLabel}
                </p>
              </div>
              {canShowAll && (
                <button
                  type="button"
                  onClick={() => onShowAllProductsChange(true)}
                  className="shrink-0 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  {labels.topProductsShowAll}
                </button>
              )}
            </div>
            <div className="mt-2">{sortControl}</div>
          </div>

          {productsLoading ? (
            <div className="h-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          ) : topProducts.length === 0 ? (
            <p className="text-sm text-slate-500">{labels.emptyProducts}</p>
          ) : (
            <ProductSalesTable products={topProducts} labels={labels} />
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
                      <KasirTh className="whitespace-nowrap">
                        {labels.categoryName}
                      </KasirTh>
                      <KasirTh className="whitespace-nowrap">{labels.profit}</KasirTh>
                      <KasirTh className="whitespace-nowrap text-right">
                        {labels.qty}
                      </KasirTh>
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
                          {formatQtyLine(
                            category.qty,
                            undefined,
                            labels.soldLabel,
                          )}
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

      <Modal
        open={showAllProducts}
        onClose={() => onShowAllProductsChange(false)}
        title={labels.topProductsAllTitle}
        description={periodLabel}
        size="lg"
      >
        <div className="mb-3">{sortControl}</div>
        {allProducts === undefined ? (
          <div className="h-40 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        ) : allProducts.length === 0 ? (
          <p className="text-sm text-slate-500">{labels.emptyProducts}</p>
        ) : (
          <ProductSalesTable products={allProducts} labels={labels} />
        )}
      </Modal>
    </>
  );
}
