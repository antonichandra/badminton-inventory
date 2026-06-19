import type { MutationCtx } from "../_generated/server";

export interface InventoryResetSummary {
  saleLineCostLotsDeleted: number;
  saleLinesDeleted: number;
  paymentBatchesDeleted: number;
  cashEntriesDeleted: number;
  stockMovementsDeleted: number;
  shiftStockSnapshotsDeleted: number;
  shiftCogsLotsDeleted: number;
  shiftSummariesDeleted: number;
  shiftCloseRequestsDeleted: number;
  stockReceiptItemsDeleted: number;
  supplierCostHistoryDeleted: number;
  stockReceiptsDeleted: number;
  shiftsDeleted: number;
  sellPriceHistoryDeleted: number;
  businessDailyRollupsDeleted: number;
  productsDeleted: number;
  suppliersDeleted: number;
}

async function deleteAllRows<T extends { _id: unknown }>(
  ctx: MutationCtx,
  queryFn: () => Promise<T[]>,
): Promise<number> {
  const rows = await queryFn();
  for (const row of rows) {
    await ctx.db.delete(row._id as never);
  }
  return rows.length;
}

/** Wipes all inventory, shift, and sales data. Keeps users, businesses, and memberships. */
export async function resetAllInventoryData(
  ctx: MutationCtx,
): Promise<InventoryResetSummary> {
  const saleLineCostLotsDeleted = await deleteAllRows(ctx, () =>
    ctx.db.query("saleLineCostLots").collect(),
  );

  const saleLinesDeleted = await deleteAllRows(ctx, () =>
    ctx.db.query("saleLines").collect(),
  );

  const paymentBatchesDeleted = await deleteAllRows(ctx, () =>
    ctx.db.query("paymentBatches").collect(),
  );

  const cashEntriesDeleted = await deleteAllRows(ctx, () =>
    ctx.db.query("cashEntries").collect(),
  );

  const stockMovementsDeleted = await deleteAllRows(ctx, () =>
    ctx.db.query("stockMovements").collect(),
  );

  const shiftStockSnapshotsDeleted = await deleteAllRows(ctx, () =>
    ctx.db.query("shiftStockSnapshots").collect(),
  );

  const shiftCogsLotsDeleted = await deleteAllRows(ctx, () =>
    ctx.db.query("shiftCogsLots").collect(),
  );

  const shiftSummariesDeleted = await deleteAllRows(ctx, () =>
    ctx.db.query("shiftSummaries").collect(),
  );

  const shiftCloseRequestsDeleted = await deleteAllRows(ctx, () =>
    ctx.db.query("shiftCloseRequests").collect(),
  );

  const stockReceiptItemsDeleted = await deleteAllRows(ctx, () =>
    ctx.db.query("stockReceiptItems").collect(),
  );

  const supplierCostHistoryDeleted = await deleteAllRows(ctx, () =>
    ctx.db.query("supplierCostHistory").collect(),
  );

  const stockReceiptsDeleted = await deleteAllRows(ctx, () =>
    ctx.db.query("stockReceipts").collect(),
  );

  const shiftsDeleted = await deleteAllRows(ctx, () =>
    ctx.db.query("shifts").collect(),
  );

  const sellPriceHistoryDeleted = await deleteAllRows(ctx, () =>
    ctx.db.query("sellPriceHistory").collect(),
  );

  const businessDailyRollupsDeleted = await deleteAllRows(ctx, () =>
    ctx.db.query("businessDailyRollups").collect(),
  );

  const productsDeleted = await deleteAllRows(ctx, () =>
    ctx.db.query("products").collect(),
  );

  const suppliersDeleted = await deleteAllRows(ctx, () =>
    ctx.db.query("suppliers").collect(),
  );

  return {
    saleLineCostLotsDeleted,
    saleLinesDeleted,
    paymentBatchesDeleted,
    cashEntriesDeleted,
    stockMovementsDeleted,
    shiftStockSnapshotsDeleted,
    shiftCogsLotsDeleted,
    shiftSummariesDeleted,
    shiftCloseRequestsDeleted,
    stockReceiptItemsDeleted,
    supplierCostHistoryDeleted,
    stockReceiptsDeleted,
    shiftsDeleted,
    sellPriceHistoryDeleted,
    businessDailyRollupsDeleted,
    productsDeleted,
    suppliersDeleted,
  };
}
