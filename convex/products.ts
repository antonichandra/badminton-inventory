import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { productType } from "./schema";
import {
  requireMasterBusinessContext,
  resolveScopedBusinessId,
} from "./lib/businessContext";
import { assertAcl, getAuthenticatedUser, hasAcl } from "./lib/rbac";
import { getActiveUnitCostForProduct } from "./lib/inventoryCostHelpers";

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
          unitCost = await getActiveUnitCostForProduct(
            ctx,
            businessId,
            product._id,
          );
          margin =
            unitCost !== null ? product.sellPrice - unitCost : null;
        }
        enriched.push({ ...product, unitCost, margin });
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

      return products
        .filter((product) => product.isActive && product.type === "RETAIL")
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("listRetailProductsForShift failed:", error);
      return [];
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

      return products
        .filter((product) => product.isActive)
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("listActiveProductsForKasir failed:", error);
      return [];
    }
  },
});

export const createProduct = mutation({
  args: {
    sessionToken: v.string(),
    name: v.string(),
    type: productType,
    sellPrice: v.number(),
    rentalPricePerHour: v.optional(v.number()),
    unit: v.string(),
    trackExpiry: v.optional(v.boolean()),
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
      sellPrice,
      rentalPricePerHour:
        args.type === "RENTAL" ? args.rentalPricePerHour : undefined,
      unit,
      trackExpiry: args.type === "RETAIL" ? (args.trackExpiry ?? false) : false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    if (args.type === "RETAIL" && sellPrice > 0) {
      await ctx.db.insert("sellPriceHistory", {
        productId,
        businessId: activeBusinessId,
        price: sellPrice,
        effectiveAt: now,
        changedBy: user._id,
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
    isActive: v.boolean(),
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

    const now = Date.now();
    const newSellPrice = args.type === "RETAIL" ? args.sellPrice : 0;

    if (
      args.type === "RETAIL" &&
      newSellPrice !== product.sellPrice
    ) {
      await ctx.db.insert("sellPriceHistory", {
        productId: args.productId,
        businessId: activeBusinessId,
        price: newSellPrice,
        effectiveAt: now,
        changedBy: user._id,
      });
    }

    await ctx.db.patch(args.productId, {
      name,
      type: args.type,
      sellPrice: newSellPrice,
      rentalPricePerHour:
        args.type === "RENTAL" ? args.rentalPricePerHour : undefined,
      unit,
      trackExpiry:
        args.type === "RETAIL" ? (args.trackExpiry ?? false) : false,
      isActive: args.isActive,
      updatedAt: now,
    });

    return { success: true };
  },
});
