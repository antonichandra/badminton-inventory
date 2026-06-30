import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  MISS_INPUT_GROUP_KEY,
  UNGROUPED_GROUP_KEY,
  normalizeGroupKey,
} from "./groupLabelHelpers";
import {
  formatDateKey,
  getShiftCashSummary,
  getShiftSalesStats,
  getShiftStockReconciliation,
} from "./shiftHelpers";
import { resolveSaleLineCogs, getFallbackUnitCost } from "./inventoryCostHelpers";
import { buildPhysicalSalesByPriceTier, shouldRebuildClosedPhysicalTiers } from "./shiftPhysicalRevenueHelpers";
import { resolveProductCategory } from "./productCategoryHelpers";
import { resolveRetailSellPriceAt } from "./productPriceHistoryHelpers";

export const SHIFT_RETENTION_LIMIT = 10;

/** shiftSummaries nested validators reject unknown fields (e.g. unitCost). */
export function sanitizeShiftSummarySalesStats<
  T extends { unitCost?: number },
>(entries: T[]) {
  return entries.map(({ unitCost: _unitCost, ...rest }) => rest);
}

export interface SaleDateRange {
  startDateKey: string;
  endDateKey: string;
}

export function rollingSaleDateRange(days: number): SaleDateRange {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return {
    startDateKey: formatDateKey(start.getTime()),
    endDateKey: formatDateKey(end.getTime()),
  };
}

export function monthSaleDateRange(year: number, month: number): SaleDateRange {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return {
    startDateKey: formatDateKey(start.getTime()),
    endDateKey: formatDateKey(end.getTime()),
  };
}

export function yearSaleDateRange(year: number): SaleDateRange {
  return {
    startDateKey: `${year}-01-01`,
    endDateKey: `${year}-12-31`,
  };
}

function isPaidLineInRange(
  line: Doc<"saleLines">,
  range: SaleDateRange,
): boolean {
  if (line.paymentStatus !== "PAID") return false;
  const date = formatDateKey(line.paidAt ?? line.createdAt);
  return date >= range.startDateKey && date <= range.endDateKey;
}

function isShiftSummaryInRange(
  closedAt: number,
  range: SaleDateRange,
): boolean {
  const date = formatDateKey(closedAt);
  return date >= range.startDateKey && date <= range.endDateKey;
}

function monthKeyFromDateKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

type ProductAggregate = {
  productId: Id<"products">;
  productName: string;
  unit: string;
  qty: number;
  revenue: number;
  cogs: number;
};

type CategoryAggregate = {
  categoryId?: Id<"productCategories">;
  categoryName: string;
  qty: number;
  revenue: number;
  cogs: number;
};

type ProductAdjustment = {
  productId: Id<"products">;
  productName: string;
  unit: string;
  qtyDelta: number;
  revenueDelta: number;
  cogsDelta: number;
};

/** Miss/over input deltas for retail — attributed to shift close date. */
async function computeRetailStockAdjustmentsForSummary(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  summary: Doc<"shiftSummaries">,
): Promise<ProductAdjustment[]> {
  const adjustments: ProductAdjustment[] = [];
  const asOf = summary.closedAt;

  for (const row of summary.stockReconciliation) {
    if (row.missInputQty <= 0 && row.overInputQty <= 0) continue;

    const product = await ctx.db.get(row.productId);
    if (!product || product.type !== "RETAIL") continue;

    const unitPrice = await resolveRetailSellPriceAt(
      ctx,
      row.productId,
      businessId,
      asOf,
    );
    const unitCost = await getFallbackUnitCost(ctx, businessId, row.productId);

    let qtyDelta = 0;
    let revenueDelta = 0;
    let cogsDelta = 0;

    if (row.missInputQty > 0) {
      qtyDelta += row.missInputQty;
      revenueDelta += row.missInputQty * unitPrice;
      cogsDelta += row.missInputQty * unitCost;
    }
    if (row.overInputQty > 0) {
      qtyDelta -= row.overInputQty;
      revenueDelta -= row.overInputQty * unitPrice;
      cogsDelta -= row.overInputQty * unitCost;
    }

    if (qtyDelta !== 0 || revenueDelta !== 0) {
      adjustments.push({
        productId: row.productId,
        productName: row.productName,
        unit: product.unit,
        qtyDelta,
        revenueDelta,
        cogsDelta,
      });
    }
  }

  return adjustments;
}

function applyProductAdjustment(
  productMap: Map<string, ProductAggregate>,
  adjustment: ProductAdjustment,
) {
  const key = adjustment.productId;
  const entry = productMap.get(key) ?? {
    productId: adjustment.productId,
    productName: adjustment.productName,
    unit: adjustment.unit,
    qty: 0,
    revenue: 0,
    cogs: 0,
  };
  entry.qty += adjustment.qtyDelta;
  entry.revenue += adjustment.revenueDelta;
  entry.cogs += adjustment.cogsDelta;
  if (!entry.unit.trim() && adjustment.unit.trim()) {
    entry.unit = adjustment.unit;
  }
  productMap.set(key, entry);
}

async function enrichProductAggregateUnits(
  ctx: QueryCtx | MutationCtx,
  productMap: Map<string, ProductAggregate>,
) {
  await Promise.all(
    Array.from(productMap.values()).map(async (entry) => {
      if (entry.unit.trim()) return;
      const product = await ctx.db.get(entry.productId);
      entry.unit = product?.unit ?? "";
    }),
  );
}

function formatTopSellingProducts(
  productMap: Map<string, ProductAggregate>,
  limit: number,
) {
  return Array.from(productMap.values())
    .filter((product) => product.qty > 0)
    .map((product) => ({
      productId: product.productId,
      productName: product.productName,
      unit: product.unit,
      qty: product.qty,
      unitPrice:
        product.qty > 0 ? Math.round(product.revenue / product.qty) : 0,
      revenue: product.revenue,
      grossProfit: product.revenue - product.cogs,
    }))
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, limit);
}

/**
 * Paid kasir lines by paidAt + miss/over input on shift close date.
 * Open shifts: recorded sales only. Closed shifts: +miss / −over on closedAt.
 */
export async function aggregateDailyRollupsHybrid(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  range: SaleDateRange,
) {
  const lines = await ctx.db
    .query("saleLines")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  const byDate = new Map<string, { totalRevenue: number; totalCogs: number }>();
  const unitCostCache = new Map();

  for (const line of lines) {
    if (!isPaidLineInRange(line, range)) continue;

    const date = formatDateKey(line.paidAt ?? line.createdAt);
    const entry = byDate.get(date) ?? { totalRevenue: 0, totalCogs: 0 };
    entry.totalRevenue += line.lineTotal;
    entry.totalCogs += await resolveSaleLineCogs(
      ctx,
      businessId,
      line,
      unitCostCache,
    );
    byDate.set(date, entry);
  }

  const summaries = await ctx.db
    .query("shiftSummaries")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  for (const summary of summaries) {
    if (!isShiftSummaryInRange(summary.closedAt, range)) continue;

    const closeDate = formatDateKey(summary.closedAt);
    const adjustments = await computeRetailStockAdjustmentsForSummary(
      ctx,
      businessId,
      summary,
    );

    let revenueDelta = 0;
    let cogsDelta = 0;
    for (const adjustment of adjustments) {
      revenueDelta += adjustment.revenueDelta;
      cogsDelta += adjustment.cogsDelta;
    }

    if (revenueDelta === 0 && cogsDelta === 0) continue;

    const entry = byDate.get(closeDate) ?? { totalRevenue: 0, totalCogs: 0 };
    entry.totalRevenue += revenueDelta;
    entry.totalCogs += cogsDelta;
    byDate.set(closeDate, entry);
  }

  return Array.from(byDate.entries())
    .map(([date, stats]) => ({
      businessId,
      date,
      totalRevenue: stats.totalRevenue,
      totalCogs: stats.totalCogs,
      grossProfit: stats.totalRevenue - stats.totalCogs,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Paid lines in range + stock adjustments for shifts closed in range.
 */
export async function aggregateTopSellingProductsHybrid(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  range: SaleDateRange,
  limit = 10,
) {
  const lines = await ctx.db
    .query("saleLines")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  const productMap = new Map<string, ProductAggregate>();
  const unitCostCache = new Map();

  for (const line of lines) {
    if (!isPaidLineInRange(line, range)) continue;

    const product = await ctx.db.get(line.productId);
    const key = line.productId;
    const entry = productMap.get(key) ?? {
      productId: line.productId,
      productName: product?.name ?? "—",
      unit: product?.unit ?? "",
      qty: 0,
      revenue: 0,
      cogs: 0,
    };
    entry.qty += line.qty;
    entry.revenue += line.lineTotal;
    entry.cogs += await resolveSaleLineCogs(
      ctx,
      businessId,
      line,
      unitCostCache,
    );
    productMap.set(key, entry);
  }

  const summaries = await ctx.db
    .query("shiftSummaries")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  for (const summary of summaries) {
    if (!isShiftSummaryInRange(summary.closedAt, range)) continue;

    const adjustments = await computeRetailStockAdjustmentsForSummary(
      ctx,
      businessId,
      summary,
    );
    for (const adjustment of adjustments) {
      applyProductAdjustment(productMap, adjustment);
    }
  }

  await enrichProductAggregateUnits(ctx, productMap);
  return formatTopSellingProducts(productMap, limit);
}

/**
 * Paid lines by paidAt month + stock adjustments by closedAt month.
 */
export async function aggregateMonthlyRevenueHybrid(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  thisMonthKey: string,
  lastMonthKey: string,
) {
  const lines = await ctx.db
    .query("saleLines")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  let thisMonth = 0;
  let lastMonth = 0;

  for (const line of lines) {
    if (line.paymentStatus !== "PAID") continue;
    const month = monthKeyFromDateKey(
      formatDateKey(line.paidAt ?? line.createdAt),
    );
    if (month === thisMonthKey) {
      thisMonth += line.lineTotal;
    } else if (month === lastMonthKey) {
      lastMonth += line.lineTotal;
    }
  }

  const summaries = await ctx.db
    .query("shiftSummaries")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  for (const summary of summaries) {
    const month = monthKeyFromDateKey(formatDateKey(summary.closedAt));
    if (month !== thisMonthKey && month !== lastMonthKey) continue;

    const adjustments = await computeRetailStockAdjustmentsForSummary(
      ctx,
      businessId,
      summary,
    );
    const revenueDelta = adjustments.reduce(
      (sum, adjustment) => sum + adjustment.revenueDelta,
      0,
    );

    if (month === thisMonthKey) {
      thisMonth += revenueDelta;
    } else {
      lastMonth += revenueDelta;
    }
  }

  return { thisMonth, lastMonth };
}

/** Daily revenue/COGS from closed shifts (physical stock source of truth). */
export async function aggregateDailyRollupsFromShiftSummaries(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  range: SaleDateRange,
) {
  const summaries = await ctx.db
    .query("shiftSummaries")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  const byDate = new Map<string, { totalRevenue: number; totalCogs: number }>();

  for (const summary of summaries) {
    if (!isShiftSummaryInRange(summary.closedAt, range)) continue;

    const date = formatDateKey(summary.closedAt);
    const entry = byDate.get(date) ?? { totalRevenue: 0, totalCogs: 0 };
    entry.totalRevenue += summary.totalRevenue;
    entry.totalCogs += summary.totalCogs;
    byDate.set(date, entry);
  }

  return Array.from(byDate.entries())
    .map(([date, stats]) => ({
      businessId,
      date,
      totalRevenue: stats.totalRevenue,
      totalCogs: stats.totalCogs,
      grossProfit: stats.totalRevenue - stats.totalCogs,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function aggregateMonthlyRevenueFromShiftSummaries(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  thisMonthKey: string,
  lastMonthKey: string,
) {
  const summaries = await ctx.db
    .query("shiftSummaries")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  let thisMonth = 0;
  let lastMonth = 0;

  for (const summary of summaries) {
    const dateKey = formatDateKey(summary.closedAt);
    if (dateKey.startsWith(thisMonthKey)) {
      thisMonth += summary.totalRevenue;
    } else if (dateKey.startsWith(lastMonthKey)) {
      lastMonth += summary.totalRevenue;
    }
  }

  return { thisMonth, lastMonth };
}

/** Top products from physical stock reconciliation + paid rental lines per shift. */
export async function aggregateTopSellingProductsFromShiftSummaries(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  range: SaleDateRange,
  limit = 10,
) {
  const summaries = await ctx.db
    .query("shiftSummaries")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  const productMap = new Map<
    string,
    {
      productId: Id<"products">;
      productName: string;
      qty: number;
      revenue: number;
      cogs: number;
    }
  >();

  for (const summary of summaries) {
    if (!isShiftSummaryInRange(summary.closedAt, range)) continue;

    if (
      summary.salesByPriceTier.length > 0 &&
      !shouldRebuildClosedPhysicalTiers(
        summary.salesByPriceTier,
        summary.stockReconciliation,
      )
    ) {
      for (const tier of summary.salesByPriceTier) {
        const key = tier.productId;
        const entry = productMap.get(key) ?? {
          productId: tier.productId,
          productName: tier.productName,
          qty: 0,
          revenue: 0,
          cogs: 0,
        };
        entry.qty += tier.qty;
        entry.revenue += tier.revenue;
        entry.cogs += tier.cogs ?? 0;
        productMap.set(key, entry);
      }
      continue;
    }

    if (summary.stockReconciliation.length > 0) {
      const tiers = await buildPhysicalSalesByPriceTier(
        ctx,
        summary.shiftId,
        businessId,
        summary.stockReconciliation,
        true,
        summary.closedAt,
      );
      for (const tier of tiers) {
        const key = tier.productId;
        const entry = productMap.get(key) ?? {
          productId: tier.productId,
          productName: tier.productName,
          qty: 0,
          revenue: 0,
          cogs: 0,
        };
        entry.qty += tier.qty;
        entry.revenue += tier.revenue;
        entry.cogs += tier.cogs;
        productMap.set(key, entry);
      }
      continue;
    }

    const lines = await ctx.db
      .query("saleLines")
      .withIndex("by_shiftId", (q) => q.eq("shiftId", summary.shiftId))
      .collect();

    for (const line of lines) {
      if (line.paymentStatus !== "PAID") continue;
      const product = await ctx.db.get(line.productId);
      if (!product || product.type === "RETAIL") continue;

      const key = line.productId;
      const entry = productMap.get(key) ?? {
        productId: line.productId,
        productName: product.name,
        qty: 0,
        revenue: 0,
        cogs: 0,
      };
      entry.qty += line.qty;
      entry.revenue += line.lineTotal;
      productMap.set(key, entry);
    }
  }

  return Array.from(productMap.values())
    .map((product) => ({
      productId: product.productId,
      productName: product.productName,
      qty: product.qty,
      unitPrice:
        product.qty > 0 ? Math.round(product.revenue / product.qty) : 0,
      revenue: product.revenue,
      grossProfit: product.revenue - product.cogs,
    }))
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, limit);
}

export async function aggregateDailyRollupsFromSaleLines(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  range: SaleDateRange,
) {
  const lines = await ctx.db
    .query("saleLines")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  const byDate = new Map<string, { totalRevenue: number; totalCogs: number }>();
  const unitCostCache = new Map();

  for (const line of lines) {
    if (!isPaidLineInRange(line, range)) continue;

    const date = formatDateKey(line.paidAt ?? line.createdAt);
    const entry = byDate.get(date) ?? { totalRevenue: 0, totalCogs: 0 };
    entry.totalRevenue += line.lineTotal;
    entry.totalCogs += await resolveSaleLineCogs(
      ctx,
      businessId,
      line,
      unitCostCache,
    );
    byDate.set(date, entry);
  }

  return Array.from(byDate.entries())
    .map(([date, stats]) => ({
      businessId,
      date,
      totalRevenue: stats.totalRevenue,
      totalCogs: stats.totalCogs,
      grossProfit: stats.totalRevenue - stats.totalCogs,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function aggregateTopSellingProductsFromSaleLines(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  range: SaleDateRange,
  limit = 10,
) {
  const lines = await ctx.db
    .query("saleLines")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  const productMap = new Map<
    string,
    {
      productId: Id<"products">;
      productName: string;
      qty: number;
      revenue: number;
      cogs: number;
    }
  >();
  const unitCostCache = new Map();

  for (const line of lines) {
    if (!isPaidLineInRange(line, range)) continue;

    const product = await ctx.db.get(line.productId);
    const key = line.productId;
    const entry = productMap.get(key) ?? {
      productId: line.productId,
      productName: product?.name ?? "—",
      qty: 0,
      revenue: 0,
      cogs: 0,
    };
    entry.qty += line.qty;
    entry.revenue += line.lineTotal;
    entry.cogs += await resolveSaleLineCogs(
      ctx,
      businessId,
      line,
      unitCostCache,
    );
    productMap.set(key, entry);
  }

  return Array.from(productMap.values())
    .map((product) => ({
      productId: product.productId,
      productName: product.productName,
      qty: product.qty,
      unitPrice:
        product.qty > 0 ? Math.round(product.revenue / product.qty) : 0,
      revenue: product.revenue,
      grossProfit: product.revenue - product.cogs,
    }))
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, limit);
}

type SpendingGroupAggregate = {
  groupLabel: string;
  totalSpend: number;
  products: Map<
    string,
    {
      productId: Id<"products">;
      productName: string;
      unit: string;
      qty: number;
      revenue: number;
    }
  >;
  categories: Map<
    string,
    {
      categoryId?: Id<"productCategories">;
      categoryName: string;
      qty: number;
      revenue: number;
    }
  >;
};

function getOrCreateSpendingGroup(
  groupMap: Map<string, SpendingGroupAggregate>,
  groupKey: string,
  groupLabel: string,
): SpendingGroupAggregate {
  const existing = groupMap.get(groupKey);
  if (existing) return existing;

  const group: SpendingGroupAggregate = {
    groupLabel,
    totalSpend: 0,
    products: new Map(),
    categories: new Map(),
  };
  groupMap.set(groupKey, group);
  return group;
}

async function addSpendingToGroup(
  ctx: QueryCtx | MutationCtx,
  group: SpendingGroupAggregate,
  productId: Id<"products">,
  qty: number,
  revenue: number,
) {
  if (qty <= 0 || revenue <= 0) return;

  const product = await ctx.db.get(productId);
  group.totalSpend += revenue;

  const productEntry = group.products.get(productId) ?? {
    productId,
    productName: product?.name ?? "—",
    unit: product?.unit ?? "",
    qty: 0,
    revenue: 0,
  };
  productEntry.qty += qty;
  productEntry.revenue += revenue;
  group.products.set(productId, productEntry);

  const category = product
    ? await resolveProductCategory(ctx, product)
    : { categoryName: "—" as const };
  const categoryKey = category.categoryId ?? "__uncategorized__";
  const categoryEntry = group.categories.get(categoryKey) ?? {
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    qty: 0,
    revenue: 0,
  };
  categoryEntry.qty += qty;
  categoryEntry.revenue += revenue;
  group.categories.set(categoryKey, categoryEntry);
}

function formatTopSpendingGroups(
  groupMap: Map<string, SpendingGroupAggregate>,
  limit: number,
) {
  return Array.from(groupMap.values())
    .map((group) => ({
      groupLabel: group.groupLabel,
      totalSpend: group.totalSpend,
      products: Array.from(group.products.values())
        .map((product) => ({
          ...product,
          unitPrice:
            product.qty > 0 ? Math.round(product.revenue / product.qty) : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue || b.qty - a.qty),
      categories: Array.from(group.categories.values())
        .map((category) => ({
          ...category,
          unitPrice:
            category.qty > 0 ? Math.round(category.revenue / category.qty) : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue || b.qty - a.qty),
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, limit);
}

export async function aggregateTopSpendingGroupsFromSaleLines(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  range: SaleDateRange,
  limit = 10,
) {
  const lines = await ctx.db
    .query("saleLines")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  const groupMap = new Map<string, SpendingGroupAggregate>();

  for (const line of lines) {
    if (!isPaidLineInRange(line, range)) continue;

    const rawLabel = line.groupLabel?.trim();
    const groupKey = rawLabel ? normalizeGroupKey(rawLabel) : UNGROUPED_GROUP_KEY;
    const groupLabel = rawLabel ?? UNGROUPED_GROUP_KEY;
    const group = getOrCreateSpendingGroup(groupMap, groupKey, groupLabel);
    await addSpendingToGroup(
      ctx,
      group,
      line.productId,
      line.qty,
      line.lineTotal,
    );
  }

  return formatTopSpendingGroups(groupMap, limit);
}

/**
 * Paid lines in range (ungrouped → virtual bucket) + miss input on shift close date.
 */
export async function aggregateTopSpendingGroupsHybrid(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  range: SaleDateRange,
  limit = 10,
) {
  const lines = await ctx.db
    .query("saleLines")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  const groupMap = new Map<string, SpendingGroupAggregate>();

  for (const line of lines) {
    if (!isPaidLineInRange(line, range)) continue;

    const rawLabel = line.groupLabel?.trim();
    const groupKey = rawLabel ? normalizeGroupKey(rawLabel) : UNGROUPED_GROUP_KEY;
    const groupLabel = rawLabel ?? UNGROUPED_GROUP_KEY;
    const group = getOrCreateSpendingGroup(groupMap, groupKey, groupLabel);
    await addSpendingToGroup(
      ctx,
      group,
      line.productId,
      line.qty,
      line.lineTotal,
    );
  }

  const summaries = await ctx.db
    .query("shiftSummaries")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  for (const summary of summaries) {
    if (!isShiftSummaryInRange(summary.closedAt, range)) continue;

    const asOf = summary.closedAt;
    for (const row of summary.stockReconciliation) {
      if (row.missInputQty <= 0) continue;

      const product = await ctx.db.get(row.productId);
      if (!product || product.type !== "RETAIL") continue;

      const unitPrice = await resolveRetailSellPriceAt(
        ctx,
        row.productId,
        businessId,
        asOf,
      );
      const revenue = row.missInputQty * unitPrice;
      const group = getOrCreateSpendingGroup(
        groupMap,
        MISS_INPUT_GROUP_KEY,
        MISS_INPUT_GROUP_KEY,
      );
      await addSpendingToGroup(
        ctx,
        group,
        row.productId,
        row.missInputQty,
        revenue,
      );
    }
  }

  return formatTopSpendingGroups(groupMap, limit);
}

export async function aggregateTopSellingCategoriesFromSaleLines(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  range: SaleDateRange,
  limit = 10,
) {
  const lines = await ctx.db
    .query("saleLines")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  const categoryMap = new Map<string, CategoryAggregate>();
  const unitCostCache = new Map();

  for (const line of lines) {
    if (!isPaidLineInRange(line, range)) continue;

    const product = await ctx.db.get(line.productId);
    const category = product
      ? await resolveProductCategory(ctx, product)
      : { categoryName: "—" as const };
    const key = category.categoryId ?? "__uncategorized__";
    const cogs = await resolveSaleLineCogs(
      ctx,
      businessId,
      line,
      unitCostCache,
    );
    addCategoryAggregate(categoryMap, key, category, line.qty, line.lineTotal, cogs);
  }

  return formatTopSellingCategories(categoryMap, limit);
}

function addCategoryAggregate(
  categoryMap: Map<string, CategoryAggregate>,
  key: string,
  category: { categoryId?: Id<"productCategories">; categoryName: string },
  qty: number,
  revenue: number,
  cogs: number,
) {
  const entry = categoryMap.get(key) ?? {
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    qty: 0,
    revenue: 0,
    cogs: 0,
  };
  entry.qty += qty;
  entry.revenue += revenue;
  entry.cogs += cogs;
  categoryMap.set(key, entry);
}

function formatTopSellingCategories(
  categoryMap: Map<string, CategoryAggregate>,
  limit: number,
) {
  return Array.from(categoryMap.values())
    .filter((category) => category.qty > 0)
    .map((category) => ({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      qty: category.qty,
      revenue: category.revenue,
      grossProfit: category.revenue - category.cogs,
    }))
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, limit);
}

/**
 * Paid lines in range + stock adjustments for shifts closed in range.
 */
export async function aggregateTopSellingCategoriesHybrid(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  range: SaleDateRange,
  limit = 10,
) {
  const lines = await ctx.db
    .query("saleLines")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  const categoryMap = new Map<string, CategoryAggregate>();
  const unitCostCache = new Map();

  for (const line of lines) {
    if (!isPaidLineInRange(line, range)) continue;

    const product = await ctx.db.get(line.productId);
    const category = product
      ? await resolveProductCategory(ctx, product)
      : { categoryName: "—" as const };
    const key = category.categoryId ?? "__uncategorized__";
    const cogs = await resolveSaleLineCogs(
      ctx,
      businessId,
      line,
      unitCostCache,
    );
    addCategoryAggregate(categoryMap, key, category, line.qty, line.lineTotal, cogs);
  }

  const summaries = await ctx.db
    .query("shiftSummaries")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  for (const summary of summaries) {
    if (!isShiftSummaryInRange(summary.closedAt, range)) continue;

    const adjustments = await computeRetailStockAdjustmentsForSummary(
      ctx,
      businessId,
      summary,
    );
    for (const adjustment of adjustments) {
      const product = await ctx.db.get(adjustment.productId);
      const category = product
        ? await resolveProductCategory(ctx, product)
        : { categoryName: "—" as const };
      const key = category.categoryId ?? "__uncategorized__";
      addCategoryAggregate(
        categoryMap,
        key,
        category,
        adjustment.qtyDelta,
        adjustment.revenueDelta,
        adjustment.cogsDelta,
      );
    }
  }

  return formatTopSellingCategories(categoryMap, limit);
}

export async function buildAndSaveShiftSummary(
  ctx: MutationCtx,
  shift: Doc<"shifts">,
  closedAt: number,
) {
  const salesStats = await getShiftSalesStats(ctx, shift._id);
  const cashSummary = await getShiftCashSummary(ctx, {
    ...shift,
    closedAt,
    status: "CLOSED",
  });
  const stockReconciliation = await getShiftStockReconciliation(
    ctx,
    shift._id,
  );

  const existing = await ctx.db
    .query("shiftSummaries")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
    .unique();

  const summaryData = {
    shiftId: shift._id,
    businessId: shift.businessId,
    closedAt,
    totalRevenue: salesStats.paidRevenue,
    totalCogs: salesStats.totalCogs,
    grossProfit: salesStats.grossProfit,
    cashSales: cashSummary.cashSales,
    qrisSales: cashSummary.qrisSales,
    expenses: cashSummary.expenses,
    deposits: cashSummary.deposits,
    variance: cashSummary.variance,
    salesByPriceTier: sanitizeShiftSummarySalesStats(
      salesStats.salesByPriceTier,
    ),
    topProducts: sanitizeShiftSummarySalesStats(salesStats.topProducts),
    stockReconciliation,
    createdAt: closedAt,
  };

  if (existing) {
    await ctx.db.patch(existing._id, summaryData);
  } else {
    await ctx.db.insert("shiftSummaries", summaryData);
  }

  await updateDailyRollups(ctx, shift.businessId, closedAt);

  return summaryData;
}

export async function updateDailyRollupsFromShiftSummary(
  ctx: MutationCtx,
  businessId: Id<"businesses">,
  closedAt: number,
) {
  const date = formatDateKey(closedAt);

  const summaries = await ctx.db
    .query("shiftSummaries")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  const daySummaries = summaries.filter(
    (summary) => formatDateKey(summary.closedAt) === date,
  );

  const productMap = new Map<
    string,
    { productId: Id<"products">; qty: number; revenue: number; cogs: number }
  >();

  let totalRevenue = 0;
  let totalCogs = 0;

  for (const summary of daySummaries) {
    totalRevenue += summary.totalRevenue;
    totalCogs += summary.totalCogs;
    for (const product of summary.topProducts) {
      const key = product.productId;
      const entry = productMap.get(key) ?? {
        productId: product.productId,
        qty: 0,
        revenue: 0,
        cogs: 0,
      };
      entry.qty += product.qty;
      entry.revenue += product.revenue;
      productMap.set(key, entry);
    }
  }

  const existing = await ctx.db
    .query("businessDailyRollups")
    .withIndex("by_business_and_date", (q) =>
      q.eq("businessId", businessId).eq("date", date),
    )
    .unique();

  const rollupData = {
    businessId,
    date,
    totalRevenue,
    totalCogs,
    grossProfit: totalRevenue - totalCogs,
    byProduct: Array.from(productMap.values()),
    updatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, rollupData);
  } else {
    await ctx.db.insert("businessDailyRollups", rollupData);
  }
}

export async function updateDailyRollups(
  ctx: MutationCtx,
  businessId: Id<"businesses">,
  closedAt: number,
) {
  const date = formatDateKey(closedAt);

  const existing = await ctx.db
    .query("businessDailyRollups")
    .withIndex("by_business_and_date", (q) =>
      q.eq("businessId", businessId).eq("date", date),
    )
    .unique();

  const productMap = new Map<
    string,
    { productId: Id<"products">; qty: number; revenue: number; cogs: number }
  >();

  const lines = await ctx.db
    .query("saleLines")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  const unitCostCache = new Map();

  for (const line of lines) {
    if (line.paymentStatus !== "PAID") continue;
    if (formatDateKey(line.paidAt ?? line.createdAt) !== date) continue;
    const key = line.productId;
    const entry = productMap.get(key) ?? {
      productId: line.productId,
      qty: 0,
      revenue: 0,
      cogs: 0,
    };
    entry.qty += line.qty;
    entry.revenue += line.lineTotal;
    entry.cogs += await resolveSaleLineCogs(
      ctx,
      businessId,
      line,
      unitCostCache,
    );
    productMap.set(key, entry);
  }

  const byProduct = Array.from(productMap.values());
  const totalRevenue = byProduct.reduce((s, p) => s + p.revenue, 0);
  const totalCogs = byProduct.reduce((s, p) => s + p.cogs, 0);

  const rollupData = {
    businessId,
    date,
    totalRevenue,
    totalCogs,
    grossProfit: totalRevenue - totalCogs,
    byProduct,
    updatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, rollupData);
  } else {
    await ctx.db.insert("businessDailyRollups", rollupData);
  }
}

export async function canSafelyDeleteShift(
  ctx: MutationCtx,
  shiftId: Id<"shifts">,
): Promise<boolean> {
  const receipts = await ctx.db
    .query("stockReceipts")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();

  for (const receipt of receipts) {
    const items = await ctx.db
      .query("stockReceiptItems")
      .withIndex("by_receiptId", (q) => q.eq("receiptId", receipt._id))
      .collect();
    for (const item of items) {
      if (item.qtyRemaining > 0) return false;
    }
  }

  return true;
}

export async function deleteShiftCompletely(
  ctx: MutationCtx,
  shiftId: Id<"shifts">,
) {
  const shift = await ctx.db.get(shiftId);
  if (!shift || shift.status !== "CLOSED") return;

  await forceDeleteShift(ctx, shiftId);
}

/** Deletes a shift and all related rows regardless of status (ops reset). */
export async function forceDeleteShift(
  ctx: MutationCtx,
  shiftId: Id<"shifts">,
) {
  const shift = await ctx.db.get(shiftId);
  if (!shift) return;

  await purgeShiftDetailRows(ctx, shiftId, shift.businessId);

  const cogsLots = await ctx.db
    .query("shiftCogsLots")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();
  for (const lot of cogsLots) await ctx.db.delete(lot._id);

  const summary = await ctx.db
    .query("shiftSummaries")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .unique();
  if (summary) await ctx.db.delete(summary._id);

  const closeRequests = await ctx.db
    .query("shiftCloseRequests")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();
  for (const request of closeRequests) await ctx.db.delete(request._id);

  await ctx.db.delete(shiftId);
}

export async function enforceShiftRetentionLimit(
  ctx: MutationCtx,
  businessId: Id<"businesses">,
  limit: number = SHIFT_RETENTION_LIMIT,
) {
  const closedShifts = (await ctx.db
    .query("shifts")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect())
    .filter((shift) => shift.status === "CLOSED")
    .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));

  const candidates = closedShifts.slice(limit);
  if (candidates.length === 0) return;

  for (const shift of candidates.sort(
    (a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0),
  )) {
    if (!(await canSafelyDeleteShift(ctx, shift._id))) continue;
    await deleteShiftCompletely(ctx, shift._id);
  }
}

async function purgeShiftDetailRows(
  ctx: MutationCtx,
  shiftId: Id<"shifts">,
  businessId: Id<"businesses">,
) {
  const saleLines = await ctx.db
    .query("saleLines")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();

  for (const line of saleLines) {
    const lots = await ctx.db
      .query("saleLineCostLots")
      .withIndex("by_saleLineId", (q) => q.eq("saleLineId", line._id))
      .collect();
    for (const lot of lots) {
      await ctx.db.delete(lot._id);
    }
    await ctx.db.delete(line._id);
  }

  const movements = await ctx.db
    .query("stockMovements")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();
  for (const m of movements) await ctx.db.delete(m._id);

  const cashEntries = await ctx.db
    .query("cashEntries")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();
  for (const e of cashEntries) await ctx.db.delete(e._id);

  const batches = await ctx.db
    .query("paymentBatches")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();
  for (const b of batches) await ctx.db.delete(b._id);

  const receipts = await ctx.db
    .query("stockReceipts")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();
  const costHistory = await ctx.db
    .query("supplierCostHistory")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  for (const receipt of receipts) {
    const items = await ctx.db
      .query("stockReceiptItems")
      .withIndex("by_receiptId", (q) => q.eq("receiptId", receipt._id))
      .collect();
    for (const item of items) await ctx.db.delete(item._id);

    for (const entry of costHistory) {
      if (entry.receiptId === receipt._id) {
        await ctx.db.delete(entry._id);
      }
    }

    await ctx.db.delete(receipt._id);
  }

  const snapshots = await ctx.db
    .query("shiftStockSnapshots")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();
  for (const s of snapshots) await ctx.db.delete(s._id);
}
