import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

type UnitCostCache = Map<Id<"products">, number>;

/** COGS for a paid sale line — uses stored value or HPP batch fallback (RETAIL only). */
export async function resolveSaleLineCogs(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  line: Doc<"saleLines">,
  unitCostCache: UnitCostCache = new Map(),
): Promise<number> {
  if (line.cogsTotal != null) return line.cogsTotal;

  const product = await ctx.db.get(line.productId);
  if (!product || product.type !== "RETAIL") return 0;

  let unitCost = unitCostCache.get(line.productId);
  if (unitCost === undefined) {
    unitCost = await getFallbackUnitCost(ctx, businessId, line.productId);
    unitCostCache.set(line.productId, unitCost);
  }

  return line.qty * unitCost;
}

export async function getLatestReceiptUnitCost(
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

  if (batches.length === 0) return null;

  const latest = batches.reduce((best, batch) =>
    batch.createdAt > best.createdAt ? batch : best,
  );
  return latest.unitCost;
}

export async function getFallbackUnitCost(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  productId: Id<"products">,
): Promise<number> {
  const fromActiveBatch = await getActiveUnitCostForProduct(
    ctx,
    businessId,
    productId,
  );
  if (fromActiveBatch !== null) return fromActiveBatch;

  const fromLatestReceipt = await getLatestReceiptUnitCost(
    ctx,
    businessId,
    productId,
  );
  if (fromLatestReceipt !== null) return fromLatestReceipt;

  const product = await ctx.db.get(productId);
  return product?.defaultUnitCost ?? 0;
}

export async function allocateCostForShiftConsumption(
  ctx: MutationCtx,
  businessId: Id<"businesses">,
  productId: Id<"products">,
  qty: number,
  shiftId: Id<"shifts">,
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

    await ctx.db.insert("shiftCogsLots", {
      shiftId,
      businessId,
      productId,
      receiptItemId: batch._id,
      qty: take,
      unitCost: batch.unitCost,
      isEstimated: false,
    });

    totalCost += take * batch.unitCost;
    remaining -= take;
  }

  if (remaining > 0) {
    const fallback = await getFallbackUnitCost(ctx, businessId, productId);
    await ctx.db.insert("shiftCogsLots", {
      shiftId,
      businessId,
      productId,
      qty: remaining,
      unitCost: fallback,
      isEstimated: true,
    });
    totalCost += remaining * fallback;
  }

  return totalCost;
}

/** @deprecated Sales no longer allocate COGS at payment time. */
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
