import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  allocateCostForShiftConsumption,
  getFallbackUnitCost,
} from "./inventoryCostHelpers";
import { resolveRetailSellPriceAt } from "./productPriceHistoryHelpers";
import {
  buildPhysicalSalesByPriceTier,
  computePhysicalTotalRevenue,
  type PhysicalStockSoldRow,
} from "./shiftPhysicalRevenueHelpers";
import {
  getShiftCashSummary,
  getShiftSalesByPriceTier,
  getShiftSalesStats,
  getShiftStockReconciliation,
  sumStockMovementsByProduct,
} from "./shiftHelpers";
import {
  enforceShiftRetentionLimit,
  sanitizeShiftSummarySalesStats,
  updateDailyRollupsFromShiftSummary,
} from "./shiftReportHelpers";
import { resolveProductCategory } from "./productCategoryHelpers";

export {
  buildPhysicalSalesByPriceTier,
  computePhysicalTotalRevenue,
  shouldRebuildClosedPhysicalTiers,
} from "./shiftPhysicalRevenueHelpers";

export interface ClosingStockItem {
  productId: Id<"products">;
  qty: number;
}

export async function hasShiftClosingStockCount(
  ctx: QueryCtx | MutationCtx,
  shiftId: Id<"shifts">,
): Promise<boolean> {
  const snapshots = await ctx.db
    .query("shiftStockSnapshots")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();
  return snapshots.some((snapshot) => snapshot.closingQty !== undefined);
}

export async function estimatePhysicalCogsForShift(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  shiftId: Id<"shifts">,
  stockRows: PhysicalStockSoldRow[],
): Promise<number> {
  const lots = await ctx.db
    .query("shiftCogsLots")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();
  if (lots.length > 0) {
    return lots.reduce((sum, lot) => sum + lot.qty * lot.unitCost, 0);
  }

  let total = 0;
  for (const row of stockRows) {
    const product = await ctx.db.get(row.productId);
    if (!product || product.type !== "RETAIL") continue;
    const sold = Math.max(0, row.soldQtyFromStock ?? row.soldFromStock ?? 0);
    if (sold <= 0) continue;
    const unitCost = await getFallbackUnitCost(ctx, businessId, row.productId);
    total += sold * unitCost;
  }
  return total;
}

function buildCashReconciliation(
  openingCash: number,
  physicalTotalSales: number,
  cashIncome: number,
  verifiedQris: number,
  expenses: number,
  deposits: number,
  reportedCash: number,
) {
  const expectedCashInDrawer =
    openingCash +
    physicalTotalSales +
    cashIncome -
    verifiedQris -
    expenses -
    deposits;
  const totalExpected =
    openingCash + physicalTotalSales + cashIncome - expenses - deposits;
  const totalActual = reportedCash + verifiedQris;

  return {
    totalSales: physicalTotalSales,
    expectedCashInDrawer,
    cashVariance: reportedCash - expectedCashInDrawer,
    totalExpected,
    totalVariance: totalActual - totalExpected,
    expectedCash: expectedCashInDrawer,
    expectedTotal: totalExpected,
    variance: totalActual - totalExpected,
  };
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

  const recordedRevenue = salesStats.paidRevenue;
  let impliedRevenue = 0;
  for (const row of stockReconciliation) {
    if (row.missInputQty <= 0) continue;
    const product = await ctx.db.get(row.productId);
    if (!product || product.type !== "RETAIL") continue;
    const unitPrice = await resolveRetailSellPriceAt(
      ctx,
      row.productId,
      shift.businessId,
      now,
    );
    impliedRevenue += row.missInputQty * unitPrice;
  }
  const totalRevenue = await computePhysicalTotalRevenue(
    ctx,
    shift._id,
    shift.businessId,
    stockReconciliation,
    now,
  );
  const grossProfit = totalRevenue - totalCogs;

  const physicalTiers = await buildPhysicalSalesByPriceTier(
    ctx,
    shift._id,
    shift.businessId,
    stockReconciliation,
    true,
    now,
  );
  const topProducts = physicalTiers
    .map((tier) => ({
      productId: tier.productId,
      productName: tier.productName,
      categoryId: tier.categoryId,
      categoryName: tier.categoryName,
      qty: tier.qty,
      revenue: tier.revenue,
      cogs: tier.cogs,
      unitCost: tier.unitCost,
      grossProfit: tier.grossProfit,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const cashRecon = buildCashReconciliation(
    closedShift.openingCash,
    totalRevenue,
    cashSummary.cashIncome,
    cashSummary.verifiedQris,
    cashSummary.expenses,
    cashSummary.deposits,
    cashSummary.reportedCash,
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
    totalRevenue,
    recordedRevenue,
    impliedRevenue,
    cashIncome: cashSummary.cashIncome,
    totalCogs,
    grossProfit,
    cashSales: cashSummary.recordedCashSales,
    qrisSales: cashSummary.recordedQrisSales,
    expenses: cashSummary.expenses,
    deposits: cashSummary.deposits,
    variance: cashRecon.totalVariance,
    totalSales: cashRecon.totalSales,
    verifiedQris: cashSummary.verifiedQris,
    reportedCash: cashSummary.reportedCash,
    expectedCashInDrawer: cashRecon.expectedCashInDrawer,
    cashVariance: cashRecon.cashVariance,
    totalVariance: cashRecon.totalVariance,
    overInputQtyTotal,
    missInputQtyTotal,
    recordedCashSales: cashSummary.recordedCashSales,
    recordedQrisSales: cashSummary.recordedQrisSales,
    salesByPriceTier: sanitizeShiftSummarySalesStats(physicalTiers),
    topProducts: sanitizeShiftSummarySalesStats(topProducts),
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
    salesByPriceTier: await getShiftSalesByPriceTier(ctx, shift._id, shift.businessId),
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

  const stockPreview: Array<{
    productId: Id<"products">;
    productName: string;
    categoryId?: Id<"productCategories">;
    categoryName: string;
    openingQty: number;
    receivedQty: number;
    writeOffQty: number;
    closingQty: number;
    soldFromStock: number;
    soldFromLines: number;
    overInputQty: number;
    missInputQty: number;
    unitPrice: number;
    revenue: number;
  }> = [];
  let overInputQtyTotal = 0;
  let missInputQtyTotal = 0;
  let impliedRevenue = 0;
  const previewAsOf = Date.now();

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

    const unitPrice =
      product.type === "RETAIL"
        ? await resolveRetailSellPriceAt(
            ctx,
            snapshot.productId,
            shift.businessId,
            previewAsOf,
          )
        : 0;
    const soldQtyForRevenue = Math.max(0, soldFromStock);
    const revenue =
      product.type === "RETAIL" ? soldQtyForRevenue * unitPrice : 0;

    if (product.type === "RETAIL" && missInputQty > 0) {
      impliedRevenue += missInputQty * unitPrice;
    }

    const category = await resolveProductCategory(ctx, product);

    stockPreview.push({
      productId: snapshot.productId,
      productName: product.name,
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      openingQty: snapshot.openingQty,
      receivedQty: received,
      writeOffQty: writeOff,
      closingQty,
      soldFromStock,
      soldFromLines,
      overInputQty,
      missInputQty,
      unitPrice,
      revenue,
    });
  }

  const previewShift = {
    ...shift,
    closingCash: reportedCash,
    closingQris: verifiedQris,
  };
  const cashSummary = await getShiftCashSummary(ctx, previewShift);
  const recordedRevenue = cashSummary.totalSales;
  const totalRevenue = await computePhysicalTotalRevenue(
    ctx,
    shift._id,
    shift.businessId,
    stockPreview,
    previewAsOf,
  );
  const cashRecon = buildCashReconciliation(
    shift.openingCash,
    totalRevenue,
    cashSummary.cashIncome,
    verifiedQris,
    cashSummary.expenses,
    cashSummary.deposits,
    reportedCash,
  );

  return {
    stockPreview,
    overInputQtyTotal,
    missInputQtyTotal,
    recordedRevenue,
    impliedRevenue,
    totalRevenue,
    cashSummary: {
      ...cashSummary,
      ...cashRecon,
    },
  };
}
