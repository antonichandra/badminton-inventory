import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  requireMasterBusinessContext,
  resolveScopedBusinessId,
} from "./lib/businessContext";
import { assertAcl, getAuthenticatedUser, hasAcl } from "./lib/rbac";
import {
  countProductsForCategory,
  validateCategoryForBusiness,
} from "./lib/productCategoryHelpers";

const categoryStatus = v.union(v.literal("ACTIVE"), v.literal("INACTIVE"));

export const DEFAULT_PRODUCT_CATEGORIES = [
  "Apparel",
  "Shuttlecock",
  "Snack",
  "Food",
  "Drinks",
] as const;

export const listCategories = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
    includeInactive: v.optional(v.boolean()),
    search: v.optional(v.string()),
    statuses: v.optional(v.array(categoryStatus)),
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

      const categories = await ctx.db
        .query("productCategories")
        .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
        .collect();

      const searchTerm = args.search?.trim().toLowerCase() ?? "";
      const statusFilter = args.statuses ?? [];

      const filtered = categories
        .filter((category) => {
          if (statusFilter.length > 0) {
            const status = category.isActive ? "ACTIVE" : "INACTIVE";
            if (!statusFilter.includes(status)) {
              return false;
            }
          } else if (!args.includeInactive && !category.isActive) {
            return false;
          }

          if (searchTerm && !category.name.toLowerCase().includes(searchTerm)) {
            return false;
          }

          return true;
        })
        .sort((a, b) => {
          const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name);
        });

      const enriched = [];
      for (const category of filtered) {
        const linkedProductCount = await countProductsForCategory(
          ctx,
          businessId,
          category._id,
        );
        enriched.push({ ...category, linkedProductCount });
      }
      return enriched;
    } catch (error) {
      console.error("listCategories failed:", error);
      return [];
    }
  },
});

export const listCategoryOptions = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args) => {
    try {
      const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
      if (!hasAcl(role, "master_produk") && !hasAcl(role, "kasir")) {
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

      const categories = await ctx.db
        .query("productCategories")
        .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
        .collect();

      return categories
        .filter((category) => category.isActive)
        .map((category) => ({
          value: category._id,
          label: category.name,
        }))
        .sort((a, b) => {
          const catA = categories.find((c) => c._id === a.value);
          const catB = categories.find((c) => c._id === b.value);
          const orderA = catA?.sortOrder ?? Number.MAX_SAFE_INTEGER;
          const orderB = catB?.sortOrder ?? Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          return a.label.localeCompare(b.label);
        });
    } catch (error) {
      console.error("listCategoryOptions failed:", error);
      return [];
    }
  },
});

export const createCategory = mutation({
  args: {
    sessionToken: v.string(),
    name: v.string(),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { role, activeBusinessId } = await requireMasterBusinessContext(
      ctx,
      args.sessionToken,
    );
    assertAcl(role, "master_produk");

    const name = args.name.trim();
    if (!name) {
      throw new Error("INVALID_INPUT");
    }

    const now = Date.now();
    const categoryId = await ctx.db.insert("productCategories", {
      businessId: activeBusinessId,
      name,
      sortOrder: args.sortOrder,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return { categoryId };
  },
});

export const updateCategory = mutation({
  args: {
    sessionToken: v.string(),
    categoryId: v.id("productCategories"),
    name: v.string(),
    sortOrder: v.optional(v.number()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { role, activeBusinessId } = await requireMasterBusinessContext(
      ctx,
      args.sessionToken,
    );
    assertAcl(role, "master_produk");

    await validateCategoryForBusiness(ctx, activeBusinessId, args.categoryId, {
      requireActive: false,
    });

    const name = args.name.trim();
    if (!name) {
      throw new Error("INVALID_INPUT");
    }

    const now = Date.now();
    await ctx.db.patch(args.categoryId, {
      name,
      sortOrder: args.sortOrder,
      isActive: args.isActive,
      updatedAt: now,
    });

    return { success: true };
  },
});

export const seedDefaultCategories = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const { role, activeBusinessId } = await requireMasterBusinessContext(
      ctx,
      args.sessionToken,
    );
    assertAcl(role, "master_produk");

    const existing = await ctx.db
      .query("productCategories")
      .withIndex("by_businessId", (q) => q.eq("businessId", activeBusinessId))
      .collect();

    if (existing.length > 0) {
      return { created: 0, message: "Categories already exist" };
    }

    const now = Date.now();
    let created = 0;
    for (let i = 0; i < DEFAULT_PRODUCT_CATEGORIES.length; i++) {
      await ctx.db.insert("productCategories", {
        businessId: activeBusinessId,
        name: DEFAULT_PRODUCT_CATEGORIES[i],
        sortOrder: i,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      created++;
    }

    return { created };
  },
});
