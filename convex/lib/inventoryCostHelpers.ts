import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export async function allocateCostForSaleLine(
  ctx: MutationCtx,
  businessId: Id<"businesses">,
  productId: Id<"products">,
  qty: number,
  saleLineId: Id<"saleLines">,
): Promise<number> {
  const batches = await ctx.db
    .query("stockReceiptItems")
    .withIndex("by_business_and_product", (q) =>
      q.eq("businessId", businessId).eq("productId", productId),
    )
    .collect();

  const available = batches
    .filter((batch) => batch.qtyRemaining > 0)
    .sort((a, b) => {
      const aExpiry = a.expiresAt ?? Number.MAX_SAFE_INTEGER;
      const bExpiry = b.expiresAt ?? Number.MAX_SAFE_INTEGER;
      if (aExpiry !== bExpiry) return aExpiry - bExpiry;
      return a.createdAt - b.createdAt;
    });

  let remaining = qty;
  let totalCost = 0;

  for (const batch of available) {
    if (remaining <= 0) break;

    const take = Math.min(remaining, batch.qtyRemaining);
    await ctx.db.patch(batch._id, {
      qtyRemaining: batch.qtyRemaining - take,
    });

    await ctx.db.insert("saleLineCostLots", {
      saleLineId,
      receiptItemId: batch._id,
      qty: take,
      unitCost: batch.unitCost,
    });

    totalCost += take * batch.unitCost;
    remaining -= take;
  }

  return totalCost;
}

export async function reverseCostLotsForSaleLine(
  ctx: MutationCtx,
  saleLineId: Id<"saleLines">,
) {
  const lots = await ctx.db
    .query("saleLineCostLots")
    .withIndex("by_saleLineId", (q) => q.eq("saleLineId", saleLineId))
    .collect();

  for (const lot of lots) {
    const batch = await ctx.db.get(lot.receiptItemId);
    if (batch) {
      await ctx.db.patch(batch._id, {
        qtyRemaining: batch.qtyRemaining + lot.qty,
      });
    }
    await ctx.db.delete(lot._id);
  }
}

export async function getActiveUnitCostForProduct(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  productId: Id<"products">,
): Promise<number | null> {
  const batches = await ctx.db
    .query("stockReceiptItems")
    .withIndex("by_business_and_product", (q) =>
      q.eq("businessId", businessId).eq("productId", productId),
    )
    .collect();

  const available = batches
    .filter((batch) => batch.qtyRemaining > 0)
    .sort((a, b) => {
      const aExpiry = a.expiresAt ?? Number.MAX_SAFE_INTEGER;
      const bExpiry = b.expiresAt ?? Number.MAX_SAFE_INTEGER;
      if (aExpiry !== bExpiry) return aExpiry - bExpiry;
      return a.createdAt - b.createdAt;
    });

  return available[0]?.unitCost ?? null;
}
