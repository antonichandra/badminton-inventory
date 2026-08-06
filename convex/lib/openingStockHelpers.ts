import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  OPENING_DOWN_ADJUSTMENT_NOTE,
  OPENING_SUPPLIER_NAME,
} from "./openingStockConstants";
import { deleteStockReceiptCompletely } from "./stockReceiptDeleteHelpers";

export {
  OPENING_DOWN_ADJUSTMENT_NOTE,
  OPENING_SUPPLIER_NAME,
} from "./openingStockConstants";

async function getOrCreateOpeningBalanceSupplier(
  ctx: MutationCtx,
  businessId: Id<"businesses">,
  now: number,
) {
  const existing = await ctx.db
    .query("suppliers")
    .withIndex("by_business_and_name", (q) =>
      q.eq("businessId", businessId).eq("name", OPENING_SUPPLIER_NAME),
    )
    .first();

  if (existing) return existing._id;

  return ctx.db.insert("suppliers", {
    businessId,
    name: OPENING_SUPPLIER_NAME,
    description: "Supplier sistem untuk saldo awal shift",
    isActive: false,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Batches that existed before this shift (other shifts' receipts).
 * Receipts recorded during the current shift — including supplier
 * penerimaan and Saldo Awal — are excluded so opening stock only
 * adjusts prior inventory.
 */
async function getPreShiftBatchesForProduct(
  ctx: MutationCtx,
  businessId: Id<"businesses">,
  productId: Id<"products">,
  shiftId: Id<"shifts">,
) {
  const batches = await ctx.db
    .query("stockReceiptItems")
    .withIndex("by_business_and_product", (q) =>
      q.eq("businessId", businessId).eq("productId", productId),
    )
    .collect();

  const preShift = [];
  for (const batch of batches) {
    const receipt = await ctx.db.get(batch.receiptId);
    if (!receipt) continue;
    if (receipt.shiftId === shiftId) continue;
    preShift.push(batch);
  }

  return {
    batches: preShift,
    bookQty: preShift.reduce((sum, batch) => sum + batch.qtyRemaining, 0),
  };
}

/** Remove Saldo Awal receipts for this product on the current shift. */
async function clearOpeningBalanceForProductOnShift(
  ctx: MutationCtx,
  shiftId: Id<"shifts">,
  productId: Id<"products">,
) {
  const receipts = await ctx.db
    .query("stockReceipts")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();

  for (const receipt of receipts) {
    const supplier = await ctx.db.get(receipt.supplierId);
    if (supplier?.name !== OPENING_SUPPLIER_NAME) continue;

    const items = await ctx.db
      .query("stockReceiptItems")
      .withIndex("by_receiptId", (q) => q.eq("receiptId", receipt._id))
      .collect();

    const hasProduct = items.some((item) => item.productId === productId);
    if (!hasProduct) continue;

    // Opening receipts are created one product per receipt.
    await deleteStockReceiptCompletely(ctx, receipt._id, {
      allowOpeningBalance: true,
    });
  }
}

/** Reduce remaining qty from oldest batches first (matches Stok page order). */
async function reduceBatchesFifo(
  ctx: MutationCtx,
  batches: Array<{
    _id: Id<"stockReceiptItems">;
    qtyRemaining: number;
    createdAt: number;
  }>,
  qtyToReduce: number,
) {
  let remaining = qtyToReduce;
  const sorted = [...batches]
    .filter((batch) => batch.qtyRemaining > 0)
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const batch of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.qtyRemaining);
    await ctx.db.patch(batch._id, {
      qtyRemaining: batch.qtyRemaining - take,
    });
    remaining -= take;
  }
}

/**
 * Creates a Saldo Awal receipt for a positive qty increase only.
 * Prefer {@link applyOpeningStockToBook} when setting opening stock to a target.
 */
export async function createOpeningBalanceBatch(
  ctx: MutationCtx,
  args: {
    shiftId: Id<"shifts">;
    businessId: Id<"businesses">;
    productId: Id<"products">;
    qty: number;
    recordedBy: Id<"users">;
  },
) {
  if (args.qty <= 0) return;

  const product = await ctx.db.get(args.productId);
  if (!product || product.businessId !== args.businessId) {
    throw new Error("PRODUCT_NOT_FOUND");
  }
  if (product.type !== "RETAIL") return;

  const unitCost = product.defaultUnitCost;
  if (unitCost == null || unitCost <= 0) {
    throw new Error(`OPENING_UNIT_COST_REQUIRED:${product.name}`);
  }

  const now = Date.now();
  const supplierId = await getOrCreateOpeningBalanceSupplier(
    ctx,
    args.businessId,
    now,
  );

  const totalAmount = args.qty * unitCost;

  const receiptId = await ctx.db.insert("stockReceipts", {
    shiftId: args.shiftId,
    businessId: args.businessId,
    supplierId,
    note: "Saldo awal shift",
    totalAmount,
    supplierPaymentStatus: "PAID",
    paidAt: now,
    markedPaidBy: args.recordedBy,
    recordedBy: args.recordedBy,
    createdAt: now,
  });

  await ctx.db.insert("stockReceiptItems", {
    receiptId,
    businessId: args.businessId,
    productId: args.productId,
    supplierId,
    qty: args.qty,
    qtyRemaining: args.qty,
    unitCost,
    createdAt: now,
  });

  await ctx.db.insert("supplierCostHistory", {
    productId: args.productId,
    businessId: args.businessId,
    supplierId,
    unitCost,
    qty: args.qty,
    receiptId,
    effectiveAt: now,
  });

  await ctx.db.insert("stockMovements", {
    shiftId: args.shiftId,
    businessId: args.businessId,
    productId: args.productId,
    type: "OPENING",
    qty: args.qty,
    refId: receiptId,
    recordedBy: args.recordedBy,
    createdAt: now,
  });
}

/**
 * Sets pre-shift book stock to the physical opening count for a product.
 * Only batches from earlier shifts are adjusted. Penerimaan (and other
 * receipts) on the current shift are left untouched.
 * - target > pre-shift book → add Saldo Awal for the delta only
 * - target < pre-shift book → reduce oldest pre-shift batches first (FIFO)
 * - target === pre-shift book → no batch change
 */
export async function applyOpeningStockToBook(
  ctx: MutationCtx,
  args: {
    shiftId: Id<"shifts">;
    businessId: Id<"businesses">;
    productId: Id<"products">;
    qty: number;
    recordedBy: Id<"users">;
  },
) {
  if (args.qty < 0) return;

  const product = await ctx.db.get(args.productId);
  if (!product || product.businessId !== args.businessId) {
    throw new Error("PRODUCT_NOT_FOUND");
  }
  if (product.type !== "RETAIL") return;

  // Drop prior opening receipts for this product so re-apply is idempotent
  // and mid-shift supplier receipts are never part of the opening delta.
  await clearOpeningBalanceForProductOnShift(
    ctx,
    args.shiftId,
    args.productId,
  );

  const { batches, bookQty } = await getPreShiftBatchesForProduct(
    ctx,
    args.businessId,
    args.productId,
    args.shiftId,
  );
  const delta = args.qty - bookQty;

  if (delta === 0) return;

  if (delta > 0) {
    await createOpeningBalanceBatch(ctx, {
      ...args,
      qty: delta,
    });
    return;
  }

  const reduceBy = -delta;
  await reduceBatchesFifo(ctx, batches, reduceBy);

  await ctx.db.insert("stockMovements", {
    shiftId: args.shiftId,
    businessId: args.businessId,
    productId: args.productId,
    type: "ADJUSTMENT",
    qty: reduceBy,
    note: OPENING_DOWN_ADJUSTMENT_NOTE,
    recordedBy: args.recordedBy,
    createdAt: Date.now(),
  });
}
