import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export async function getLinkedProductIdsForSupplier(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  supplierId: Id<"suppliers">,
): Promise<Id<"products">[] | null> {
  const links = await ctx.db
    .query("supplierProducts")
    .withIndex("by_business_and_supplier", (q) =>
      q.eq("businessId", businessId).eq("supplierId", supplierId),
    )
    .collect();

  if (links.length === 0) return null;
  return links.map((link) => link.productId);
}

export async function assertProductsLinkedToSupplier(
  ctx: MutationCtx,
  businessId: Id<"businesses">,
  supplierId: Id<"suppliers">,
  productIds: Id<"products">[],
) {
  const linked = await getLinkedProductIdsForSupplier(
    ctx,
    businessId,
    supplierId,
  );
  if (linked === null) return;

  const linkedSet = new Set(linked);
  for (const productId of productIds) {
    if (!linkedSet.has(productId)) {
      throw new Error("PRODUCT_NOT_LINKED_TO_SUPPLIER");
    }
  }
}

export async function syncSupplierProducts(
  ctx: MutationCtx,
  businessId: Id<"businesses">,
  supplierId: Id<"suppliers">,
  productIds: Id<"products">[],
  now: number,
) {
  const uniqueProductIds = [...new Set(productIds)];

  for (const productId of uniqueProductIds) {
    const product = await ctx.db.get(productId);
    if (
      !product ||
      product.businessId !== businessId ||
      product.type !== "RETAIL"
    ) {
      throw new Error("PRODUCT_NOT_FOUND");
    }
  }

  const existing = await ctx.db
    .query("supplierProducts")
    .withIndex("by_business_and_supplier", (q) =>
      q.eq("businessId", businessId).eq("supplierId", supplierId),
    )
    .collect();

  const newSet = new Set(uniqueProductIds);
  for (const row of existing) {
    if (!newSet.has(row.productId)) {
      await ctx.db.delete(row._id);
    }
  }

  const existingIds = new Set(existing.map((row) => row.productId));
  for (const productId of uniqueProductIds) {
    if (!existingIds.has(productId)) {
      await ctx.db.insert("supplierProducts", {
        businessId,
        supplierId,
        productId,
        createdAt: now,
      });
    }
  }
}

export async function countLinkedProductsForSupplier(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  supplierId: Id<"suppliers">,
) {
  const links = await ctx.db
    .query("supplierProducts")
    .withIndex("by_business_and_supplier", (q) =>
      q.eq("businessId", businessId).eq("supplierId", supplierId),
    )
    .collect();
  return links.length;
}
