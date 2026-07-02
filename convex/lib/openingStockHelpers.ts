import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export const OPENING_SUPPLIER_NAME = "Saldo Awal";

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
