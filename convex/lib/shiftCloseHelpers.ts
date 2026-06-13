import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  allocateCostForShiftConsumption,
} from "./inventoryCostHelpers";
import {
  getShiftCashSummary,
  getShiftSalesByPriceTier,
  getShiftSalesStats,
  getShiftStockReconciliation,
  sumStockMovementsByProduct,
} from "./shiftHelpers";
import { updateDailyRollupsFromShiftSummary, enforceShiftRetentionLimit } from "./shiftReportHelpers";

export interface ClosingStockItem {
  productId: Id<"products">;
  qty: number;
}

export async function applyClosingStockSnapshots(
  ctx: MutationCtx,
  shift: Doc<"shifts">,
  businessId: Id<"businesses">,
  userId: Id<"users">,
  closingStock: ClosingStockItem[],
  now: number,
) {
  for (const item of closingStock) {
    if (item.qty < 0) continue;

    const snapshot = await ctx.db
      .query("shiftStockSnapshots")
      .withIndex("by_shift_and_product", (q) =>
        q.eq("shiftId", shift._id).eq("productId", item.productId),
      )
      .unique();

    if (!snapshot) continue;

    await ctx.db.patch(snapshot._id, {
      closingQty: item.qty,
      updatedAt: now,
    });

    await ctx.db.insert("stockMovements", {
      shiftId: shift._id,
      businessId,
      productId: item.productId,
      type: "CLOSE_COUNT",
      qty: item.qty,
      recordedBy: userId,
      createdAt: now,
    });
  }
}

export async function applyShiftStockConsumption(
  ctx: MutationCtx,
  shift: Doc<"shifts">,
  userId: Id<"users">,
  now: number,
) {
  const snapshots = await ctx.db
    .query("shiftStockSnapshots")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
    .collect();

  let totalCogs = 0;

  for (const snapshot of snapshots) {
    const product = await ctx.db.get(snapshot.productId);
    if (!product || product.type !== "RETAIL") continue;
    if (snapshot.closingQty === undefined) continue;

    const received = await sumStockMovementsByProduct(
      ctx,
      shift._id,
      snapshot.productId,
      "RECEIPT",
    );
    const writeOff = await sumStockMovementsByProduct(
      ctx,
      shift._id,
      snapshot.productId,
      "WRITEOFF",
    );

    const consumedQty = Math.max(
      0,
      snapshot.openingQty + received - snapshot.closingQty - writeOff,
    );

    if (consumedQty <= 0) continue;

    const cogs = await allocateCostForShiftConsumption(
      ctx,
      shift.businessId,
      snapshot.productId,
      consumedQty,
      shift._id,
    );
    totalCogs += cogs;

    await ctx.db.insert("stockMovements", {
      shiftId: shift._id,
      businessId: shift.businessId,
      productId: snapshot.productId,
      type: "CONSUMPTION",
      qty: consumedQty,
      recordedBy: userId,
      createdAt: now,
    });

    await syncBatchToClosingPhysical(
      ctx,
      shift.businessId,
      snapshot.productId,
      snapshot.closingQty,
    );
  }

  return totalCogs;
}

async function syncBatchToClosingPhysical(
  ctx: MutationCtx,
  businessId: Id<"businesses">,
  productId: Id<"products">,
  closingQty: number,
) {
  const batches = await ctx.db
    .query("stockReceiptItems")
    .withIndex("by_business_and_product", (q) =>
      q.eq("businessId", businessId).eq("productId", productId),
    )
    .collect();

  const bookQty = batches.reduce((sum, batch) => sum + batch.qtyRemaining, 0);
  const delta = closingQty - bookQty;

  if (delta === 0) return;

  if (delta > 0) {
    const sorted = batches.sort((a, b) => b.createdAt - a.createdAt);
    const target = sorted[0];
    if (target) {
      await ctx.db.patch(target._id, {
        qtyRemaining: target.qtyRemaining + delta,
      });
    }
    return;
  }

  let remaining = -delta;
  const sorted = batches
    .filter((batch) => batch.qtyRemaining > 0)
    .sort((a, b) => b.createdAt - a.createdAt);

  for (const batch of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.qtyRemaining);
    await ctx.db.patch(batch._id, {
      qtyRemaining: batch.qtyRemaining - take,
    });
    remaining -= take;
  }
}

export async function finalizeShiftClose(
  ctx: MutationCtx,
  shift: Doc<"shifts">,
  userId: Id<"users">,
  reportedCash: number,
  verifiedQris: number,
  closingStock: ClosingStockItem[],
  now: number,
) {
  await applyClosingStockSnapshots(
    ctx,
    shift,
    shift.businessId,
    userId,
    closingStock,
    now,
  );

  const totalCogs = await applyShiftStockConsumption(
    ctx,
    shift,
    userId,
    now,
  );

  await ctx.db.patch(shift._id, {
    status: "CLOSED",
    closedBy: userId,
    closedAt: now,
    closingCash: reportedCash,
    closingQris: verifiedQris,
    updatedAt: now,
  });

  const closedShift = {
    ...shift,
    status: "CLOSED" as const,
    closedBy: userId,
    closedAt: now,
    closingCash: reportedCash,
    closingQris: verifiedQris,
  };

  const salesStats = await getShiftSalesStats(ctx, shift._id, totalCogs);
  const cashSummary = await getShiftCashSummary(ctx, closedShift);
  const stockReconciliation = await getShiftStockReconciliation(
    ctx,
    shift._id,
  );

  const overInputQtyTotal = stockReconciliation.reduce(
    (sum, row) => sum + row.overInputQty,
    0,
  );
  const missInputQtyTotal = stockReconciliation.reduce(
    (sum, row) => sum + row.missInputQty,
    0,
  );

  const summaryData = {
    shiftId: shift._id,
    businessId: shift.businessId,
    closedAt: now,
    totalRevenue: salesStats.paidRevenue,
    totalCogs,
    grossProfit: salesStats.paidRevenue - totalCogs,
    cashSales: cashSummary.recordedCashSales,
    qrisSales: cashSummary.recordedQrisSales,
    expenses: cashSummary.expenses,
    deposits: cashSummary.deposits,
    variance: cashSummary.totalVariance,
    totalSales: cashSummary.totalSales,
    verifiedQris: cashSummary.verifiedQris,
    reportedCash: cashSummary.reportedCash,
    expectedCashInDrawer: cashSummary.expectedCashInDrawer,
    cashVariance: cashSummary.cashVariance,
    totalVariance: cashSummary.totalVariance,
    overInputQtyTotal,
    missInputQtyTotal,
    recordedCashSales: cashSummary.recordedCashSales,
    recordedQrisSales: cashSummary.recordedQrisSales,
    salesByPriceTier: salesStats.salesByPriceTier,
    topProducts: salesStats.topProducts,
    stockReconciliation,
    createdAt: now,
  };

  const existing = await ctx.db
    .query("shiftSummaries")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, summaryData);
  } else {
    await ctx.db.insert("shiftSummaries", summaryData);
  }

  await updateDailyRollupsFromShiftSummary(ctx, shift.businessId, now);

  await enforceShiftRetentionLimit(ctx, shift.businessId);

  return {
    summary: summaryData,
    cashSummary,
    salesByPriceTier: await getShiftSalesByPriceTier(ctx, shift._id),
    totalRevenue: summaryData.totalRevenue,
  };
}

export async function getSuggestedOpeningStock(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
) {
  const closedShifts = await ctx.db
    .query("shifts")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  const lastClosed = closedShifts
    .filter((shift) => shift.status === "CLOSED")
    .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0))[0];

  if (!lastClosed) return [];

  const snapshots = await ctx.db
    .query("shiftStockSnapshots")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", lastClosed._id))
    .collect();

  return snapshots
    .filter((snapshot) => snapshot.closingQty !== undefined)
    .map((snapshot) => ({
      productId: snapshot.productId,
      qty: snapshot.closingQty ?? 0,
    }));
}

export async function computeClosePreview(
  ctx: QueryCtx | MutationCtx,
  shift: Doc<"shifts">,
  reportedCash: number,
  verifiedQris: number,
  closingStock: ClosingStockItem[],
) {
  const snapshots = await ctx.db
    .query("shiftStockSnapshots")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
    .collect();

  const closingMap = new Map(
    closingStock.map((item) => [item.productId, item.qty]),
  );

  const stockPreview = [];
  let overInputQtyTotal = 0;
  let missInputQtyTotal = 0;

  const saleLines = await ctx.db
    .query("saleLines")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
    .collect();

  const paidQtyByProduct = new Map<string, number>();
  for (const line of saleLines) {
    if (line.paymentStatus !== "PAID") continue;
    const product = await ctx.db.get(line.productId);
    if (product?.type !== "RETAIL") continue;
    paidQtyByProduct.set(
      line.productId,
      (paidQtyByProduct.get(line.productId) ?? 0) + line.qty,
    );
  }

  for (const snapshot of snapshots) {
    const product = await ctx.db.get(snapshot.productId);
    if (!product) continue;

    const received = await sumStockMovementsByProduct(
      ctx,
      shift._id,
      snapshot.productId,
      "RECEIPT",
    );
    const writeOff = await sumStockMovementsByProduct(
      ctx,
      shift._id,
      snapshot.productId,
      "WRITEOFF",
    );
    const closingQty = closingMap.get(snapshot.productId) ?? 0;
    const soldFromStock =
      snapshot.openingQty + received - closingQty - writeOff;
    const soldFromLines = paidQtyByProduct.get(snapshot.productId) ?? 0;
    const overInputQty = Math.max(0, soldFromLines - soldFromStock);
    const missInputQty = Math.max(0, soldFromStock - soldFromLines);

    overInputQtyTotal += overInputQty;
    missInputQtyTotal += missInputQty;

    stockPreview.push({
      productId: snapshot.productId,
      productName: product.name,
      openingQty: snapshot.openingQty,
      receivedQty: received,
      writeOffQty: writeOff,
      closingQty,
      soldFromStock,
      soldFromLines,
      overInputQty,
      missInputQty,
    });
  }

  const previewShift = {
    ...shift,
    closingCash: reportedCash,
    closingQris: verifiedQris,
  };
  const cashSummary = await getShiftCashSummary(ctx, previewShift);

  return {
    stockPreview,
    overInputQtyTotal,
    missInputQtyTotal,
    cashSummary,
  };
}
