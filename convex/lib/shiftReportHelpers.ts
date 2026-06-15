import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { normalizeGroupKey } from "./groupLabelHelpers";
import {
  formatDateKey,
  getShiftCashSummary,
  getShiftSalesStats,
  getShiftStockReconciliation,
} from "./shiftHelpers";
import { resolveSaleLineCogs } from "./inventoryCostHelpers";

export const SHIFT_RETENTION_LIMIT = 10;

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

  const groupMap = new Map<
    string,
    {
      groupLabel: string;
      totalSpend: number;
      products: Map<
        string,
        {
          productId: Id<"products">;
          productName: string;
          qty: number;
          revenue: number;
        }
      >;
    }
  >();

  for (const line of lines) {
    if (!isPaidLineInRange(line, range)) continue;

    const rawLabel = line.groupLabel?.trim();
    if (!rawLabel) continue;

    const groupKey = normalizeGroupKey(rawLabel);
    const product = await ctx.db.get(line.productId);

    const group = groupMap.get(groupKey) ?? {
      groupLabel: rawLabel,
      totalSpend: 0,
      products: new Map(),
    };
    group.totalSpend += line.lineTotal;

    const productEntry = group.products.get(line.productId) ?? {
      productId: line.productId,
      productName: product?.name ?? "—",
      qty: 0,
      revenue: 0,
    };
    productEntry.qty += line.qty;
    productEntry.revenue += line.lineTotal;
    group.products.set(line.productId, productEntry);
    groupMap.set(groupKey, group);
  }

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
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, limit);
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
    salesByPriceTier: salesStats.salesByPriceTier,
    topProducts: salesStats.topProducts,
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
