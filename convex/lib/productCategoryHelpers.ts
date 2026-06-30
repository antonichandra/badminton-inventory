import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const UNCATEGORIZED_LABEL = "Tanpa Kategori";

export type ProductCategoryInfo = {
  categoryId?: Id<"productCategories">;
  categoryName: string;
};

export async function resolveProductCategory(
  ctx: QueryCtx | MutationCtx,
  product: Pick<Doc<"products">, "categoryId">,
): Promise<ProductCategoryInfo> {
  if (!product.categoryId) {
    return { categoryName: UNCATEGORIZED_LABEL };
  }

  const category = await ctx.db.get(product.categoryId);
  if (!category || !category.isActive) {
    return {
      categoryId: product.categoryId,
      categoryName: category?.name ?? "Kategori Nonaktif",
    };
  }

  return {
    categoryId: product.categoryId,
    categoryName: category.name,
  };
}

export async function countProductsForCategory(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  categoryId: Id<"productCategories">,
): Promise<number> {
  const products = await ctx.db
    .query("products")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  return products.filter((product) => product.categoryId === categoryId).length;
}

export async function validateCategoryForBusiness(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  categoryId: Id<"productCategories">,
  options?: { requireActive?: boolean },
) {
  const category = await ctx.db.get(categoryId);
  if (!category || category.businessId !== businessId) {
    throw new Error("CATEGORY_NOT_FOUND");
  }
  if (options?.requireActive !== false && !category.isActive) {
    throw new Error("CATEGORY_NOT_FOUND");
  }
  return category;
}
