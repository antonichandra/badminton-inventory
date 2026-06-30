import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { productType } from "./schema";
import {
  requireMasterBusinessContext,
  resolveScopedBusinessId,
} from "./lib/businessContext";
import { assertAcl, getAuthenticatedUser, hasAcl } from "./lib/rbac";
import { getActiveUnitCostForProduct, getLatestSupplierUnitCost } from "./lib/inventoryCostHelpers";
import { recordProductPriceChange } from "./lib/productPriceHistoryHelpers";
import { getLinkedProductIdsForSupplier } from "./lib/supplierProductHelpers";
import {
  resolveProductCategory,
  validateCategoryForBusiness,
} from "./lib/productCategoryHelpers";

const productStatus = v.union(v.literal("ACTIVE"), v.literal("INACTIVE"));
const productTypeFilter = v.union(v.literal("RETAIL"), v.literal("RENTAL"));
const productTrackExpiryFilter = v.union(
  v.literal("TRACKED"),
  v.literal("NOT_TRACKED"),
);

export const listProducts = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
    includeInactive: v.optional(v.boolean()),
    search: v.optional(v.string()),
    types: v.optional(v.array(productTypeFilter)),
    statuses: v.optional(v.array(productStatus)),
    trackExpiry: v.optional(v.array(productTrackExpiryFilter)),
    categoryIds: v.optional(v.array(v.id("productCategories"))),
    uncategorized: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    try {
      const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
      if (!hasAcl(role, "master_produk")) {
        return [];
      }

      const businessId = await resolveScopedBusinessId(
        ctx,
        user,
        role,
        args.businessId,
      );
      if (!businessId) {
        return [];
      }

      const products = await ctx.db
        .query("products")
        .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
        .collect();

      const searchTerm = args.search?.trim().toLowerCase() ?? "";
      const typeFilter = args.types ?? [];
      const statusFilter = args.statuses ?? [];
      const trackExpiryFilter = args.trackExpiry ?? [];
      const categoryFilter = args.categoryIds ?? [];

      const filtered = products
        .filter((product) => {
          if (statusFilter.length > 0) {
            const status = product.isActive ? "ACTIVE" : "INACTIVE";
            if (!statusFilter.includes(status)) {
              return false;
            }
          } else if (!args.includeInactive && !product.isActive) {
            return false;
          }

          if (typeFilter.length > 0 && !typeFilter.includes(product.type)) {
            return false;
          }

          if (trackExpiryFilter.length > 0) {
            const tracked = product.trackExpiry === true;
            const matchesTracked =
              trackExpiryFilter.includes("TRACKED") && tracked;
            const matchesNotTracked =
              trackExpiryFilter.includes("NOT_TRACKED") && !tracked;
            if (!matchesTracked && !matchesNotTracked) {
              return false;
            }
          }

          if (categoryFilter.length > 0 || args.uncategorized) {
            const isUncategorized = !product.categoryId;
            const matchesUncategorized = args.uncategorized === true && isUncategorized;
            const matchesCategory =
              product.categoryId !== undefined &&
              categoryFilter.includes(product.categoryId);
            if (!matchesUncategorized && !matchesCategory) {
              return false;
            }
          }

          if (searchTerm) {
            const matchesSearch =
              product.name.toLowerCase().includes(searchTerm) ||
              product.unit.toLowerCase().includes(searchTerm);
            if (!matchesSearch) {
              return false;
            }
          }

          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      const enriched = [];
      for (const product of filtered) {
        let unitCost: number | null = null;
        let margin: number | null = null;
        if (product.type === "RETAIL") {
          unitCost =
            (await getActiveUnitCostForProduct(
              ctx,
              businessId,
              product._id,
            )) ?? product.defaultUnitCost ?? null;
          margin =
            unitCost !== null ? product.sellPrice - unitCost : null;
        }
        const category = await resolveProductCategory(ctx, product);
        enriched.push({ ...product, ...category, unitCost, margin });
      }
      return enriched;
    } catch (error) {
      console.error("listProducts failed:", error);
      return [];
    }
  },
});

export const listProductOptions = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args) => {
    try {
      const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
      if (!hasAcl(role, "master_produk")) {
        return [];
      }

      const scopedBusinessId = await resolveScopedBusinessId(
        ctx,
        user,
        role,
        args.businessId,
      );
      if (!scopedBusinessId) {
        return [];
      }

      const products = await ctx.db
        .query("products")
        .withIndex("by_businessId", (q) => q.eq("businessId", scopedBusinessId))
        .collect();

      return products
        .filter((product) => product.isActive)
        .map((product) => ({
          value: product._id,
          label: product.name,
          productType: product.type,
          sellPrice: product.sellPrice,
          rentalPricePerHour: product.rentalPricePerHour,
          unit: product.unit,
          trackExpiry: product.trackExpiry ?? false,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    } catch (error) {
      console.error("listProductOptions failed:", error);
      return [];
    }
  },
});

export const listRetailProductsForShift = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args) => {
    try {
      const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
      if (!hasAcl(role, "kasir")) {
        return [];
      }

      const businessId = await resolveScopedBusinessId(
        ctx,
        user,
        role,
        args.businessId,
      );
      if (!businessId) {
        return [];
      }

      const products = await ctx.db
        .query("products")
        .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
        .collect();

      const resolved = await Promise.all(
        products
          .filter((product) => product.isActive && product.type === "RETAIL")
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(async (product) => {
            const category = await resolveProductCategory(ctx, product);
            return {
              _id: product._id,
              name: product.name,
              unit: product.unit,
              trackExpiry: product.trackExpiry ?? false,
              defaultUnitCost: product.defaultUnitCost,
              unitsPerPurchaseUnit: product.unitsPerPurchaseUnit,
              categoryId: category.categoryId,
              categoryName: category.categoryName,
            };
          }),
      );
      return resolved;
    } catch (error) {
      console.error("listRetailProductsForShift failed:", error);
      return [];
    }
  },
});

export const listRetailProductsForSupplier = query({
  args: {
    sessionToken: v.string(),
    supplierId: v.id("suppliers"),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args) => {
    try {
      const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
      if (!hasAcl(role, "kasir")) {
        return { products: [], hasProductLinks: false };
      }

      const businessId = await resolveScopedBusinessId(
        ctx,
        user,
        role,
        args.businessId,
      );
      if (!businessId) {
        return { products: [], hasProductLinks: false };
      }

      const supplier = await ctx.db.get(args.supplierId);
      if (!supplier || supplier.businessId !== businessId || !supplier.isActive) {
        return { products: [], hasProductLinks: false };
      }

      const linkedProductIds = await getLinkedProductIdsForSupplier(
        ctx,
        businessId,
        args.supplierId,
      );

      if (linkedProductIds === null) {
        return { products: [], hasProductLinks: false };
      }

      const linkedSet = new Set(linkedProductIds);
      const products = await ctx.db
        .query("products")
        .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
        .collect();

      const retailProducts = await Promise.all(
        products
          .filter(
            (product) =>
              product.isActive &&
              product.type === "RETAIL" &&
              linkedSet.has(product._id),
          )
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(async (product) => {
            const lastSupplierUnitCost = await getLatestSupplierUnitCost(
              ctx,
              businessId,
              product._id,
              args.supplierId,
            );
            return {
              _id: product._id,
              name: product.name,
              unit: product.unit,
              purchaseUnit: product.purchaseUnit,
              trackExpiry: product.trackExpiry ?? false,
              defaultUnitCost: product.defaultUnitCost,
              unitsPerPurchaseUnit: product.unitsPerPurchaseUnit,
              lastSupplierUnitCost,
            };
          }),
      );

      return {
        products: retailProducts,
        hasProductLinks: true,
      };
    } catch (error) {
      console.error("listRetailProductsForSupplier failed:", error);
      return { products: [], hasProductLinks: false };
    }
  },
});

export const listActiveProductsForKasir = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args) => {
    try {
      const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
      if (!hasAcl(role, "kasir")) {
        return [];
      }

      const businessId = await resolveScopedBusinessId(
        ctx,
        user,
        role,
        args.businessId,
      );
      if (!businessId) {
        return [];
      }

      const products = await ctx.db
        .query("products")
        .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
        .collect();

      const activeProducts = products
        .filter((product) => product.isActive)
        .sort((a, b) => a.name.localeCompare(b.name));

      return Promise.all(
        activeProducts.map(async (product) => {
          const category = await resolveProductCategory(ctx, product);
          return { ...product, ...category };
        }),
      );
    } catch (error) {
      console.error("listActiveProductsForKasir failed:", error);
      return [];
    }
  },
});

function validateRetailCostFields(
  type: "RETAIL" | "RENTAL",
  defaultUnitCost?: number,
  unitsPerPurchaseUnit?: number,
  purchaseUnit?: string,
) {
  if (type !== "RETAIL") {
    return;
  }
  if (defaultUnitCost !== undefined && defaultUnitCost < 0) {
    throw new Error("INVALID_UNIT_COST");
  }
  if (unitsPerPurchaseUnit !== undefined && unitsPerPurchaseUnit < 1) {
    throw new Error("INVALID_PACK_SIZE");
  }

  const hasPackSize =
    unitsPerPurchaseUnit !== undefined && unitsPerPurchaseUnit >= 1;
  const hasPurchaseUnit = (purchaseUnit?.trim() ?? "") !== "";

  if (hasPackSize && !hasPurchaseUnit) {
    throw new Error("PURCHASE_UNIT_REQUIRED");
  }
  if (hasPurchaseUnit && !hasPackSize) {
    throw new Error("INVALID_PACK_SIZE");
  }
}

function normalizePurchaseFields(
  type: "RETAIL" | "RENTAL",
  unitsPerPurchaseUnit?: number,
  purchaseUnit?: string,
) {
  if (type !== "RETAIL") {
    return { unitsPerPurchaseUnit: undefined, purchaseUnit: undefined };
  }
  const packSize =
    unitsPerPurchaseUnit !== undefined && unitsPerPurchaseUnit >= 1
      ? unitsPerPurchaseUnit
      : undefined;
  const packUnit = packSize ? purchaseUnit?.trim() || undefined : undefined;
  return { unitsPerPurchaseUnit: packSize, purchaseUnit: packUnit };
}

export const createProduct = mutation({
  args: {
    sessionToken: v.string(),
    name: v.string(),
    type: productType,
    sellPrice: v.number(),
    rentalPricePerHour: v.optional(v.number()),
    unit: v.string(),
    trackExpiry: v.optional(v.boolean()),
    defaultUnitCost: v.optional(v.number()),
    unitsPerPurchaseUnit: v.optional(v.number()),
    purchaseUnit: v.optional(v.string()),
    categoryId: v.optional(v.id("productCategories")),
  },
  handler: async (ctx, args) => {
    const { user, role, activeBusinessId } = await requireMasterBusinessContext(
      ctx,
      args.sessionToken,
    );
    assertAcl(role, "master_produk");

    const name = args.name.trim();
    const unit = args.unit.trim();
    if (!name || !unit) {
      throw new Error("INVALID_INPUT");
    }

    if (args.categoryId) {
      await validateCategoryForBusiness(
        ctx,
        activeBusinessId,
        args.categoryId,
      );
    }

    const packFields = normalizePurchaseFields(
      args.type,
      args.unitsPerPurchaseUnit,
      args.purchaseUnit,
    );

    validateRetailCostFields(
      args.type,
      args.defaultUnitCost,
      packFields.unitsPerPurchaseUnit,
      packFields.purchaseUnit,
    );

    if (args.type === "RENTAL" && (args.rentalPricePerHour ?? 0) <= 0) {
      throw new Error("INVALID_RENTAL_PRICE");
    }

    if (args.type === "RETAIL" && args.sellPrice < 0) {
      throw new Error("INVALID_PRICE");
    }

    const now = Date.now();
    const sellPrice = args.type === "RETAIL" ? args.sellPrice : 0;
    const productId = await ctx.db.insert("products", {
      businessId: activeBusinessId,
      name,
      type: args.type,
      categoryId: args.categoryId,
      sellPrice,
      rentalPricePerHour:
        args.type === "RENTAL" ? args.rentalPricePerHour : undefined,
      unit,
      trackExpiry: args.type === "RETAIL" ? (args.trackExpiry ?? false) : false,
      defaultUnitCost:
        args.type === "RETAIL" ? args.defaultUnitCost : undefined,
      unitsPerPurchaseUnit: packFields.unitsPerPurchaseUnit,
      purchaseUnit: packFields.purchaseUnit,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const rentalPrice =
      args.type === "RENTAL" ? (args.rentalPricePerHour ?? 0) : 0;

    if (args.type === "RETAIL" && sellPrice > 0) {
      await recordProductPriceChange(ctx, {
        productId,
        businessId: activeBusinessId,
        price: sellPrice,
        priceKind: "RETAIL",
        changedBy: user._id,
        effectiveAt: now,
      });
    }

    if (args.type === "RENTAL" && rentalPrice > 0) {
      await recordProductPriceChange(ctx, {
        productId,
        businessId: activeBusinessId,
        price: rentalPrice,
        priceKind: "RENTAL",
        changedBy: user._id,
        effectiveAt: now,
      });
    }

    return { productId };
  },
});

export const updateProduct = mutation({
  args: {
    sessionToken: v.string(),
    productId: v.id("products"),
    name: v.string(),
    type: productType,
    sellPrice: v.number(),
    rentalPricePerHour: v.optional(v.number()),
    unit: v.string(),
    trackExpiry: v.optional(v.boolean()),
    defaultUnitCost: v.optional(v.number()),
    unitsPerPurchaseUnit: v.optional(v.number()),
    purchaseUnit: v.optional(v.string()),
    isActive: v.boolean(),
    categoryId: v.optional(v.id("productCategories")),
  },
  handler: async (ctx, args) => {
    const { user, role, activeBusinessId } = await requireMasterBusinessContext(
      ctx,
      args.sessionToken,
    );

    assertAcl(role, "master_produk");

    const product = await ctx.db.get(args.productId);
    if (!product || product.businessId !== activeBusinessId) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    const name = args.name.trim();
    const unit = args.unit.trim();
    if (!name || !unit) {
      throw new Error("INVALID_INPUT");
    }

    if (args.categoryId) {
      await validateCategoryForBusiness(
        ctx,
        activeBusinessId,
        args.categoryId,
      );
    }

    const packFields = normalizePurchaseFields(
      args.type,
      args.unitsPerPurchaseUnit,
      args.purchaseUnit,
    );

    validateRetailCostFields(
      args.type,
      args.defaultUnitCost,
      packFields.unitsPerPurchaseUnit,
      packFields.purchaseUnit,
    );

    const now = Date.now();
    const newSellPrice = args.type === "RETAIL" ? args.sellPrice : 0;

    const newRentalPrice =
      args.type === "RENTAL" ? (args.rentalPricePerHour ?? 0) : 0;

    if (args.type === "RETAIL" && newSellPrice !== product.sellPrice) {
      await recordProductPriceChange(ctx, {
        productId: args.productId,
        businessId: activeBusinessId,
        price: newSellPrice,
        priceKind: "RETAIL",
        changedBy: user._id,
        effectiveAt: now,
      });
    }

    if (
      args.type === "RENTAL" &&
      newRentalPrice !== (product.rentalPricePerHour ?? 0)
    ) {
      await recordProductPriceChange(ctx, {
        productId: args.productId,
        businessId: activeBusinessId,
        price: newRentalPrice,
        priceKind: "RENTAL",
        changedBy: user._id,
        effectiveAt: now,
      });
    }

    await ctx.db.patch(args.productId, {
      name,
      type: args.type,
      categoryId: args.categoryId,
      sellPrice: newSellPrice,
      rentalPricePerHour:
        args.type === "RENTAL" ? args.rentalPricePerHour : undefined,
      unit,
      trackExpiry:
        args.type === "RETAIL" ? (args.trackExpiry ?? false) : false,
      defaultUnitCost:
        args.type === "RETAIL" ? args.defaultUnitCost : undefined,
      unitsPerPurchaseUnit: packFields.unitsPerPurchaseUnit,
      purchaseUnit: packFields.purchaseUnit,
      isActive: args.isActive,
      updatedAt: now,
    });

    return { success: true };
  },
});
