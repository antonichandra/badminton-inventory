import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { resolveProductCategory } from "./productCategoryHelpers";
import {
  getOpenShiftForBusiness,
  sumStockMovementsByProduct,
} from "./shiftHelpers";

export interface StockCardFormItem {
  productId: Id<"products">;
  productName: string;
  categoryId?: Id<"productCategories">;
  categoryName: string;
  unit: string;
  openingQty: number;
  receivedQty: number;
  writeOffQty: number;
  soldQty: number;
  expectedQty: number;
}

export interface StockCardSnapshotItemInput {
  productId: Id<"products">;
  countedQty: number;
}

export interface StockCardSnapshotItemResult extends StockCardFormItem {
  countedQty: number;
  variance: number;
  missInputQty: number;
  overInputQty: number;
}

export async function getPaidQtyByProductForShift(
  ctx: QueryCtx | MutationCtx,
  shiftId: Id<"shifts">,
) {
  const saleLines = await ctx.db
    .query("saleLines")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();

  const paidQtyByProduct = new Map<string, number>();
  for (const line of saleLines) {
    if (line.paymentStatus !== "PAID") continue;
    const product = await ctx.db.get(line.productId);
    if (!product || product.type !== "RETAIL") continue;
    paidQtyByProduct.set(
      line.productId,
      (paidQtyByProduct.get(line.productId) ?? 0) + line.qty,
    );
  }

  return paidQtyByProduct;
}

export async function buildStockCardFormItems(
  ctx: QueryCtx | MutationCtx,
  shift: Doc<"shifts">,
): Promise<StockCardFormItem[]> {
  const snapshots = await ctx.db
    .query("shiftStockSnapshots")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
    .collect();

  const paidQtyByProduct = await getPaidQtyByProductForShift(ctx, shift._id);
  const items: StockCardFormItem[] = [];

  for (const snapshot of snapshots) {
    const product = await ctx.db.get(snapshot.productId);
    if (!product || product.type !== "RETAIL" || !product.isActive) continue;

    const receivedQty = await sumStockMovementsByProduct(
      ctx,
      shift._id,
      snapshot.productId,
      "RECEIPT",
    );
    const writeOffQty = await sumStockMovementsByProduct(
      ctx,
      shift._id,
      snapshot.productId,
      "WRITEOFF",
    );
    const soldQty = paidQtyByProduct.get(snapshot.productId) ?? 0;
    const expectedQty = Math.max(
      0,
      snapshot.openingQty + receivedQty - soldQty - writeOffQty,
    );
    const category = await resolveProductCategory(ctx, product);

    items.push({
      productId: snapshot.productId,
      productName: product.name,
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      unit: product.unit,
      openingQty: snapshot.openingQty,
      receivedQty,
      writeOffQty,
      soldQty,
      expectedQty,
    });
  }

  return items.sort((a, b) => a.productName.localeCompare(b.productName));
}

export function computeStockCardItemResult(
  formItem: StockCardFormItem,
  countedQty: number,
): StockCardSnapshotItemResult {
  const soldFromStock = Math.max(
    0,
    formItem.openingQty +
      formItem.receivedQty -
      countedQty -
      formItem.writeOffQty,
  );
  const missInputQty = Math.max(0, soldFromStock - formItem.soldQty);
  const overInputQty = Math.max(0, formItem.soldQty - soldFromStock);

  return {
    ...formItem,
    countedQty,
    variance: countedQty - formItem.expectedQty,
    missInputQty,
    overInputQty,
  };
}

export async function requireOpenShiftForStockCard(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
) {
  const shift = await getOpenShiftForBusiness(ctx, businessId);
  if (!shift) {
    throw new Error("NO_OPEN_SHIFT");
  }
  return shift;
}
