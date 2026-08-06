import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { OPENING_SUPPLIER_NAME } from "./openingStockConstants";

export async function deleteStockReceiptCompletely(
  ctx: MutationCtx,
  receiptId: Id<"stockReceipts">,
  options?: { allowOpeningBalance?: boolean },
) {
  const receipt = await ctx.db.get(receiptId);
  if (!receipt) {
    throw new Error("RECEIPT_NOT_FOUND");
  }

  const shift = await ctx.db.get(receipt.shiftId);
  if (!shift) {
    throw new Error("SHIFT_NOT_FOUND");
  }
  if (shift.status === "CLOSED") {
    throw new Error("RECEIPT_SHIFT_CLOSED");
  }

  const supplier = await ctx.db.get(receipt.supplierId);
  const isOpening = supplier?.name === OPENING_SUPPLIER_NAME;
  if (isOpening && !options?.allowOpeningBalance) {
    throw new Error("RECEIPT_CANNOT_DELETE_OPENING");
  }

  const items = await ctx.db
    .query("stockReceiptItems")
    .withIndex("by_receiptId", (q) => q.eq("receiptId", receiptId))
    .collect();

  const itemIds = new Set(items.map((item) => item._id));

  const saleLines = await ctx.db
    .query("saleLines")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", receipt.shiftId))
    .collect();

  for (const line of saleLines) {
    const lots = await ctx.db
      .query("saleLineCostLots")
      .withIndex("by_saleLineId", (q) => q.eq("saleLineId", line._id))
      .collect();
    for (const lot of lots) {
      if (itemIds.has(lot.receiptItemId)) {
        await ctx.db.delete(lot._id);
      }
    }
  }

  const shiftCogsLots = await ctx.db
    .query("shiftCogsLots")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", receipt.shiftId))
    .collect();

  for (const lot of shiftCogsLots) {
    if (lot.receiptItemId && itemIds.has(lot.receiptItemId)) {
      await ctx.db.patch(lot._id, {
        receiptItemId: undefined,
        isEstimated: true,
      });
    }
  }

  const movements = await ctx.db
    .query("stockMovements")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", receipt.shiftId))
    .collect();

  for (const movement of movements) {
    const isReceiptRef =
      movement.type === "RECEIPT" && movement.refId === receiptId;
    const isOpeningRef =
      movement.type === "OPENING" && movement.refId === receiptId;
    if (isReceiptRef || isOpeningRef) {
      await ctx.db.delete(movement._id);
    }
  }

  const costHistory = await ctx.db
    .query("supplierCostHistory")
    .withIndex("by_businessId", (q) => q.eq("businessId", receipt.businessId))
    .collect();

  for (const entry of costHistory) {
    if (entry.receiptId === receiptId) {
      await ctx.db.delete(entry._id);
    }
  }

  for (const item of items) {
    await ctx.db.delete(item._id);
  }

  await ctx.db.delete(receiptId);

  return { success: true as const };
}

export function isOpeningBalanceSupplier(supplier: Doc<"suppliers"> | null) {
  return supplier?.name === OPENING_SUPPLIER_NAME;
}
