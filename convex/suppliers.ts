import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  requireMasterBusinessContext,
  resolveScopedBusinessId,
} from "./lib/businessContext";
import { assertAcl, getAuthenticatedUser, hasAcl } from "./lib/rbac";

const supplierStatus = v.union(v.literal("ACTIVE"), v.literal("INACTIVE"));

export const listSuppliers = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
    includeInactive: v.optional(v.boolean()),
    search: v.optional(v.string()),
    statuses: v.optional(v.array(supplierStatus)),
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

      const suppliers = await ctx.db
        .query("suppliers")
        .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
        .collect();

      const searchTerm = args.search?.trim().toLowerCase() ?? "";
      const statusFilter = args.statuses ?? [];

      return suppliers
        .filter((supplier) => {
          if (statusFilter.length > 0) {
            const status = supplier.isActive ? "ACTIVE" : "INACTIVE";
            if (!statusFilter.includes(status)) {
              return false;
            }
          } else if (!args.includeInactive && !supplier.isActive) {
            return false;
          }

          if (searchTerm) {
            const matchesSearch =
              supplier.name.toLowerCase().includes(searchTerm) ||
              (supplier.description?.toLowerCase().includes(searchTerm) ??
                false) ||
              (supplier.contact?.toLowerCase().includes(searchTerm) ?? false);
            if (!matchesSearch) {
              return false;
            }
          }

          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("listSuppliers failed:", error);
      return [];
    }
  },
});

export const listSuppliersForKasir = query({
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

      const suppliers = await ctx.db
        .query("suppliers")
        .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
        .collect();

      return suppliers
        .filter((supplier) => supplier.isActive)
        .map((supplier) => ({
          value: supplier._id,
          label: supplier.name,
          description: supplier.description,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    } catch (error) {
      console.error("listSuppliersForKasir failed:", error);
      return [];
    }
  },
});

export const listSupplierOptions = query({
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

      const businessId = await resolveScopedBusinessId(
        ctx,
        user,
        role,
        args.businessId,
      );
      if (!businessId) {
        return [];
      }

      const suppliers = await ctx.db
        .query("suppliers")
        .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
        .collect();

      return suppliers
        .filter((supplier) => supplier.isActive)
        .map((supplier) => ({
          value: supplier._id,
          label: supplier.name,
          description: supplier.description,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    } catch (error) {
      console.error("listSupplierOptions failed:", error);
      return [];
    }
  },
});

export const createSupplier = mutation({
  args: {
    sessionToken: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    contact: v.optional(v.string()),
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
    const supplierId = await ctx.db.insert("suppliers", {
      businessId: activeBusinessId,
      name,
      description: args.description?.trim() || undefined,
      contact: args.contact?.trim() || undefined,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return { supplierId };
  },
});

export const updateSupplier = mutation({
  args: {
    sessionToken: v.string(),
    supplierId: v.id("suppliers"),
    name: v.string(),
    description: v.optional(v.string()),
    contact: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { role, activeBusinessId } = await requireMasterBusinessContext(
      ctx,
      args.sessionToken,
    );

    assertAcl(role, "master_produk");

    const supplier = await ctx.db.get(args.supplierId);
    if (!supplier || supplier.businessId !== activeBusinessId) {
      throw new Error("SUPPLIER_NOT_FOUND");
    }

    const name = args.name.trim();
    if (!name) {
      throw new Error("INVALID_INPUT");
    }

    await ctx.db.patch(args.supplierId, {
      name,
      description: args.description?.trim() || undefined,
      contact: args.contact?.trim() || undefined,
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
