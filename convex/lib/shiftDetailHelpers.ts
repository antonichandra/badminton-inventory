import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export async function loadShiftCashEntries(
  ctx: QueryCtx,
  shiftId: Id<"shifts">,
) {
  const entries = await ctx.db
    .query("cashEntries")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();

  const enriched = [];
  for (const entry of entries.sort((a, b) => b.createdAt - a.createdAt)) {
    const recorder = await ctx.db.get(entry.recordedBy);
    enriched.push({
      _id: entry._id,
      type: entry.type,
      amount: entry.amount,
      note: entry.note,
      createdAt: entry.createdAt,
      recordedByName: recorder?.name ?? "—",
    });
  }

  return enriched;
}

export async function loadShiftWriteOffs(
  ctx: QueryCtx,
  shiftId: Id<"shifts">,
) {
  const movements = await ctx.db
    .query("stockMovements")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();

  const rows = [];
  for (const movement of movements.filter((m) => m.type === "WRITEOFF")) {
    const product = await ctx.db.get(movement.productId);
    const recorder = await ctx.db.get(movement.recordedBy);
    rows.push({
      _id: movement._id,
      productId: movement.productId,
      productName: product?.name ?? "—",
      productUnit: product?.unit ?? "",
      qty: movement.qty,
      note: movement.note ?? "—",
      createdAt: movement.createdAt,
      recordedByName: recorder?.name ?? "—",
    });
  }

  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function loadShiftStockReceipts(
  ctx: QueryCtx,
  shiftId: Id<"shifts">,
) {
  const receipts = await ctx.db
    .query("stockReceipts")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();

  const rows = [];
  for (const receipt of receipts.sort((a, b) => b.createdAt - a.createdAt)) {
    const supplier = await ctx.db.get(receipt.supplierId);
    const recorder = await ctx.db.get(receipt.recordedBy);
    const items = await ctx.db
      .query("stockReceiptItems")
      .withIndex("by_receiptId", (q) => q.eq("receiptId", receipt._id))
      .collect();

    for (const item of items) {
      const product = await ctx.db.get(item.productId);
      rows.push({
        receiptId: receipt._id,
        createdAt: receipt.createdAt,
        supplierName: supplier?.name ?? "—",
        note: receipt.note,
        recordedByName: recorder?.name ?? "—",
        productId: item.productId,
        productName: product?.name ?? "—",
        productUnit: product?.unit ?? "",
        qty: item.qty,
        unitCost: item.unitCost,
        lineTotal: item.qty * item.unitCost,
        expiresAt: item.expiresAt,
      });
    }
  }

  return rows;
}
