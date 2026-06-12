import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  formatDateKey,
  getShiftCashSummary,
  getShiftSalesStats,
  getShiftStockReconciliation,
} from "./shiftHelpers";

const HOT_SHIFT_DETAIL_LIMIT = 10;

export async function aggregateDailyRollupsFromSaleLines(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  days: number,
) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffKey = formatDateKey(cutoff.getTime());

  const lines = await ctx.db
    .query("saleLines")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  const byDate = new Map<string, { totalRevenue: number; totalCogs: number }>();

  for (const line of lines) {
    if (line.paymentStatus !== "PAID") continue;
    const date = formatDateKey(line.paidAt ?? line.createdAt);
    if (date < cutoffKey) continue;

    const entry = byDate.get(date) ?? { totalRevenue: 0, totalCogs: 0 };
    entry.totalRevenue += line.lineTotal;
    entry.totalCogs += line.cogsTotal ?? 0;
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
    entry.cogs += line.cogsTotal ?? 0;
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

export async function purgeArchivedShiftDetails(
  ctx: MutationCtx,
  businessId: Id<"businesses">,
) {
  const closedShifts = await ctx.db
    .query("shifts")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  const archived = closedShifts
    .filter((s) => s.status === "CLOSED" && s.archiveStatus === "ARCHIVED")
    .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));

  const toKeep = new Set(
    archived.slice(0, HOT_SHIFT_DETAIL_LIMIT).map((s) => s._id),
  );

  for (const shift of archived) {
    if (toKeep.has(shift._id)) continue;
    await purgeShiftDetailRows(ctx, shift._id);
  }
}

async function purgeShiftDetailRows(
  ctx: MutationCtx,
  shiftId: Id<"shifts">,
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
  for (const receipt of receipts) {
    const items = await ctx.db
      .query("stockReceiptItems")
      .withIndex("by_receiptId", (q) => q.eq("receiptId", receipt._id))
      .collect();
    for (const item of items) await ctx.db.delete(item._id);
    await ctx.db.delete(receipt._id);
  }

  const snapshots = await ctx.db
    .query("shiftStockSnapshots")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();
  for (const s of snapshots) await ctx.db.delete(s._id);
}

export async function archiveShiftDetails(
  ctx: MutationCtx,
  shiftId: Id<"shifts">,
) {
  const shift = await ctx.db.get(shiftId);
  if (!shift || shift.status !== "CLOSED") return;

  await ctx.db.patch(shiftId, {
    archiveStatus: "ARCHIVED",
    updatedAt: Date.now(),
  });

  await purgeArchivedShiftDetails(ctx, shift.businessId);
}
