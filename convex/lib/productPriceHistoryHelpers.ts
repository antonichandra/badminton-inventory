import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getOpenShiftForBusiness } from "./shiftHelpers";

export type ProductPriceKind = "RETAIL" | "RENTAL";

export async function recordProductPriceChange(
  ctx: MutationCtx,
  args: {
    productId: Id<"products">;
    businessId: Id<"businesses">;
    price: number;
    priceKind: ProductPriceKind;
    changedBy: Id<"users">;
    effectiveAt: number;
  },
) {
  const activeShift = await getOpenShiftForBusiness(ctx, args.businessId);

  await ctx.db.insert("sellPriceHistory", {
    productId: args.productId,
    businessId: args.businessId,
    price: args.price,
    priceKind: args.priceKind,
    effectiveAt: args.effectiveAt,
    changedBy: args.changedBy,
    shiftId: activeShift?._id,
  });
}

export async function findShiftAtTimestamp(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  timestamp: number,
): Promise<Doc<"shifts"> | null> {
  const shifts = await ctx.db
    .query("shifts")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  const matches = shifts.filter(
    (shift) =>
      shift.openedAt <= timestamp &&
      (shift.closedAt == null || shift.closedAt >= timestamp),
  );

  if (matches.length === 0) return null;

  return matches.sort((a, b) => b.openedAt - a.openedAt)[0];
}

export function resolvePriceKind(
  entry: Doc<"sellPriceHistory">,
  productType?: Doc<"products">["type"],
): ProductPriceKind {
  if (entry.priceKind) return entry.priceKind;
  if (productType === "RENTAL") return "RENTAL";
  return "RETAIL";
}

/** Retail sell price effective at a point in time (falls back to current product price). */
export async function resolveRetailSellPriceAt(
  ctx: QueryCtx | MutationCtx,
  productId: Id<"products">,
  businessId: Id<"businesses">,
  timestamp: number,
): Promise<number> {
  const history = await ctx.db
    .query("sellPriceHistory")
    .withIndex("by_productId", (q) => q.eq("productId", productId))
    .collect();

  const match = history
    .filter((entry) => entry.businessId === businessId)
    .filter((entry) => resolvePriceKind(entry) === "RETAIL")
    .filter((entry) => entry.effectiveAt <= timestamp)
    .sort((a, b) => b.effectiveAt - a.effectiveAt)[0];

  if (match) return match.price;

  const product = await ctx.db.get(productId);
  return product?.sellPrice ?? 0;
}
