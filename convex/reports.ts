import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  assertBusinessAccess,
  resolveScopedBusinessId,
} from "./lib/businessContext";
import { getAuthenticatedUser, hasAcl, isAdmin, isSuperAdmin } from "./lib/rbac";
import { getActiveUnitCostForProduct } from "./lib/inventoryCostHelpers";
import {
  aggregateDailyRollupsHybrid,
  aggregateMonthlyRevenueHybrid,
  aggregateTopSellingProductsHybrid,
  aggregateTopSpendingGroupsHybrid,
  aggregateTopSellingCategoriesHybrid,
  rollingSaleDateRange,
  type SaleDateRange,
} from "./lib/shiftReportHelpers";
import {
  findShiftAtTimestamp,
  resolvePriceKind,
} from "./lib/productPriceHistoryHelpers";
import { getOpenShiftForBusiness } from "./lib/shiftHelpers";
import { resolveProductCategory } from "./lib/productCategoryHelpers";

function resolveSaleDateRange(args: {
  days?: number;
  startDate?: string;
  endDate?: string;
}): SaleDateRange {
  if (args.startDate && args.endDate) {
    return { startDateKey: args.startDate, endDateKey: args.endDate };
  }
  return rollingSaleDateRange(args.days ?? 30);
}

export const getDailyRollups = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
    days: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!hasAcl(role, "analytics")) return [];

    const businessId = await resolveScopedBusinessId(
      ctx,
      user,
      role,
      args.businessId,
    );
    if (!businessId) return [];

    await assertBusinessAccess(ctx, user, role, businessId);

    const range = resolveSaleDateRange(args);
    return aggregateDailyRollupsHybrid(ctx, businessId, range);
  },
});

export const getTopSellingProducts = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
    days: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    limit: v.optional(v.number()),
    sortBy: v.optional(
      v.union(
        v.literal("qty"),
        v.literal("revenue"),
        v.literal("grossProfit"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!hasAcl(role, "analytics")) return [];

    const businessId = await resolveScopedBusinessId(
      ctx,
      user,
      role,
      args.businessId,
    );
    if (!businessId) return [];

    await assertBusinessAccess(ctx, user, role, businessId);

    const range = resolveSaleDateRange(args);
    return aggregateTopSellingProductsHybrid(
      ctx,
      businessId,
      range,
      args.limit ?? 10,
      args.sortBy ?? "qty",
    );
  },
});

export const getTopSpendingGroups = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
    days: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!hasAcl(role, "analytics")) return [];

    const businessId = await resolveScopedBusinessId(
      ctx,
      user,
      role,
      args.businessId,
    );
    if (!businessId) return [];

    await assertBusinessAccess(ctx, user, role, businessId);

    const range = resolveSaleDateRange(args);
    return aggregateTopSpendingGroupsHybrid(
      ctx,
      businessId,
      range,
      args.limit ?? 10,
    );
  },
});

export const getTopSellingCategories = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
    days: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!hasAcl(role, "analytics")) return [];

    const businessId = await resolveScopedBusinessId(
      ctx,
      user,
      role,
      args.businessId,
    );
    if (!businessId) return [];

    await assertBusinessAccess(ctx, user, role, businessId);

    const range = resolveSaleDateRange(args);
    return aggregateTopSellingCategoriesHybrid(
      ctx,
      businessId,
      range,
      args.limit ?? 10,
    );
  },
});

export const getMonthlyComparison = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!hasAcl(role, "analytics")) {
      return { thisMonth: 0, lastMonth: 0 };
    }

    const businessId = await resolveScopedBusinessId(
      ctx,
      user,
      role,
      args.businessId,
    );
    if (!businessId) {
      return { thisMonth: 0, lastMonth: 0 };
    }

    await assertBusinessAccess(ctx, user, role, businessId);

    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;

    return aggregateMonthlyRevenueHybrid(
      ctx,
      businessId,
      thisMonthKey,
      lastMonthKey,
    );
  },
});

export const getExpiringBatches = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
    withinDays: v.optional(v.number()),
    withinMonths: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!hasAcl(role, "kasir") && !hasAcl(role, "master_produk")) {
      return [];
    }

    const businessId = await resolveScopedBusinessId(
      ctx,
      user,
      role,
      args.businessId,
    );
    if (!businessId) return [];

    await assertBusinessAccess(ctx, user, role, businessId);

    const showCost = isAdmin(role) || isSuperAdmin(role);
    const now = Date.now();
    let cutoff: number | null = null;
    if (args.withinMonths != null) {
      const date = new Date(now);
      date.setMonth(date.getMonth() + args.withinMonths);
      cutoff = date.getTime();
    } else if (args.withinDays != null) {
      cutoff = now + args.withinDays * 24 * 60 * 60 * 1000;
    }

    const batches = await ctx.db
      .query("stockReceiptItems")
      .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
      .collect();

    const openShift = await getOpenShiftForBusiness(ctx, businessId);
    const reservedByProduct = new Map<string, number>();
    if (openShift) {
      const saleLines = await ctx.db
        .query("saleLines")
        .withIndex("by_shiftId", (q) => q.eq("shiftId", openShift._id))
        .collect();

      for (const line of saleLines) {
        const product = await ctx.db.get(line.productId);
        if (!product || product.type !== "RETAIL") continue;
        reservedByProduct.set(
          line.productId,
          (reservedByProduct.get(line.productId) ?? 0) + line.qty,
        );
      }
    }

    // Allocate open-shift sales against batches FEFO (same order as COGS).
    const batchesByProduct = new Map<string, typeof batches>();
    for (const batch of batches) {
      if (batch.qtyRemaining <= 0) continue;
      const list = batchesByProduct.get(batch.productId) ?? [];
      list.push(batch);
      batchesByProduct.set(batch.productId, list);
    }

    const estimatedRemaining = new Map<string, number>();
    for (const [productId, productBatches] of batchesByProduct) {
      const sortedBatches = [...productBatches].sort((a, b) => {
        const aExpiry = a.expiresAt ?? Number.MAX_SAFE_INTEGER;
        const bExpiry = b.expiresAt ?? Number.MAX_SAFE_INTEGER;
        if (aExpiry !== bExpiry) return aExpiry - bExpiry;
        return a.createdAt - b.createdAt;
      });

      let reserved = reservedByProduct.get(productId) ?? 0;
      for (const batch of sortedBatches) {
        const take = Math.min(reserved, batch.qtyRemaining);
        reserved -= take;
        estimatedRemaining.set(batch._id, batch.qtyRemaining - take);
      }
    }

    const results = [];
    for (const batch of batches) {
      if (!batch.expiresAt) continue;
      if (cutoff != null && batch.expiresAt > cutoff) continue;

      const qtyEstimated = estimatedRemaining.get(batch._id) ?? 0;
      if (qtyEstimated <= 0) continue;

      const product = await ctx.db.get(batch.productId);
      results.push({
        productId: batch.productId,
        productName: product?.name ?? "—",
        qtyEstimated,
        expiresAt: batch.expiresAt,
        ...(showCost ? { unitCost: batch.unitCost } : {}),
      });
    }

    const sorted = results.sort(
      (a, b) => (a.expiresAt ?? 0) - (b.expiresAt ?? 0),
    );

    if (args.limit != null) {
      return sorted.slice(0, args.limit);
    }

    return sorted;
  },
});

export const getLowStockProducts = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
    maxQty: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!hasAcl(role, "kasir") && !hasAcl(role, "master_produk")) {
      return [];
    }

    const businessId = await resolveScopedBusinessId(
      ctx,
      user,
      role,
      args.businessId,
    );
    if (!businessId) return [];

    await assertBusinessAccess(ctx, user, role, businessId);

    const maxQty = args.maxQty ?? 5;
    const batches = await ctx.db
      .query("stockReceiptItems")
      .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
      .collect();

    const stockByProduct = new Map<string, number>();
    for (const batch of batches) {
      if (batch.qtyRemaining <= 0) continue;
      const key = batch.productId;
      stockByProduct.set(key, (stockByProduct.get(key) ?? 0) + batch.qtyRemaining);
    }

    const openShift = await getOpenShiftForBusiness(ctx, businessId);
    const reservedByProduct = new Map<string, number>();
    if (openShift) {
      const saleLines = await ctx.db
        .query("saleLines")
        .withIndex("by_shiftId", (q) => q.eq("shiftId", openShift._id))
        .collect();

      for (const line of saleLines) {
        const product = await ctx.db.get(line.productId);
        if (!product || product.type !== "RETAIL") continue;
        reservedByProduct.set(
          line.productId,
          (reservedByProduct.get(line.productId) ?? 0) + line.qty,
        );
      }
    }

    const products = await ctx.db
      .query("products")
      .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
      .collect();

    const results = [];
    for (const product of products) {
      if (!product.isActive || product.type !== "RETAIL") continue;

      const qtyOnHand = stockByProduct.get(product._id) ?? 0;
      const reservedQty = reservedByProduct.get(product._id) ?? 0;
      const qtyEstimated = Math.max(0, qtyOnHand - reservedQty);
      if (qtyEstimated > maxQty) continue;

      results.push({
        productId: product._id,
        productName: product.name,
        unit: product.unit,
        qtyEstimated,
        trackExpiry: product.trackExpiry ?? false,
      });
    }

    return results.sort((a, b) => {
      if (a.qtyEstimated !== b.qtyEstimated) {
        return a.qtyEstimated - b.qtyEstimated;
      }
      return a.productName.localeCompare(b.productName);
    });
  },
});

export const getProductMarginSummary = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!hasAcl(role, "master_produk")) return [];

    const businessId = await resolveScopedBusinessId(
      ctx,
      user,
      role,
      args.businessId,
    );
    if (!businessId) return [];

    const products = await ctx.db
      .query("products")
      .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
      .collect();

    const results = [];
    for (const product of products.filter((p) => p.isActive && p.type === "RETAIL")) {
      const unitCost = await getActiveUnitCostForProduct(
        ctx,
        businessId,
        product._id,
      );
      const margin =
        unitCost !== null ? product.sellPrice - unitCost : null;
      const marginPct =
        unitCost !== null && product.sellPrice > 0
          ? ((product.sellPrice - unitCost) / product.sellPrice) * 100
          : null;

      results.push({
        productId: product._id,
        name: product.name,
        sellPrice: product.sellPrice,
        unitCost,
        margin,
        marginPct,
        trackExpiry: product.trackExpiry ?? false,
      });
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const getProductPriceHistory = query({
  args: {
    sessionToken: v.string(),
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!hasAcl(role, "master_produk")) return [];

    const product = await ctx.db.get(args.productId);
    if (!product) return [];

    await assertBusinessAccess(ctx, user, role, product.businessId);

    const history = await ctx.db
      .query("sellPriceHistory")
      .withIndex("by_productId", (q) => q.eq("productId", args.productId))
      .collect();

    const enriched = [];
    for (const entry of history.sort((a, b) => b.effectiveAt - a.effectiveAt)) {
      const changer = await ctx.db.get(entry.changedBy);
      const priceKind = resolvePriceKind(entry, product.type);

      let shift = entry.shiftId ? await ctx.db.get(entry.shiftId) : null;
      if (!shift) {
        shift = await findShiftAtTimestamp(
          ctx,
          product.businessId,
          entry.effectiveAt,
        );
      }

      enriched.push({
        _id: entry._id,
        price: entry.price,
        priceKind,
        effectiveAt: entry.effectiveAt,
        changedByName: changer?.name ?? "—",
        shiftId: shift?._id,
        shiftOpenedAt: shift?.openedAt,
        shiftClosedAt: shift?.closedAt,
        shiftStatus: shift?.status,
      });
    }

    return enriched;
  },
});

/** @deprecated Use getProductPriceHistory */
export const getSellPriceHistory = getProductPriceHistory;

export const LOW_STOCK_THRESHOLD = 5;

export const getInventoryStock = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!hasAcl(role, "kasir") && !hasAcl(role, "master_produk")) {
      return { hasOpenShift: false, products: [] };
    }

    const businessId = await resolveScopedBusinessId(
      ctx,
      user,
      role,
      args.businessId,
    );
    if (!businessId) return { hasOpenShift: false, products: [] };

    await assertBusinessAccess(ctx, user, role, businessId);

    const searchLower = args.search?.trim().toLowerCase() ?? "";

    const products = await ctx.db
      .query("products")
      .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
      .collect();

    const retailProducts = products
      .filter((product) => product.isActive && product.type === "RETAIL")
      .filter((product) =>
        searchLower ? product.name.toLowerCase().includes(searchLower) : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    const batchRows = await ctx.db
      .query("stockReceiptItems")
      .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
      .collect();

    const supplierCache = new Map<string, string>();
    async function supplierName(supplierId: (typeof batchRows)[0]["supplierId"]) {
      const key = supplierId;
      if (supplierCache.has(key)) return supplierCache.get(key)!;
      const supplier = await ctx.db.get(supplierId);
      const name = supplier?.name ?? "—";
      supplierCache.set(key, name);
      return name;
    }

    const batchesByProduct = new Map<string, typeof batchRows>();
    for (const batch of batchRows) {
      if (batch.qtyRemaining <= 0) continue;
      const list = batchesByProduct.get(batch.productId) ?? [];
      list.push(batch);
      batchesByProduct.set(batch.productId, list);
    }

    const openShift = await getOpenShiftForBusiness(ctx, businessId);
    const reservedByProduct = new Map<string, number>();
    if (openShift) {
      const saleLines = await ctx.db
        .query("saleLines")
        .withIndex("by_shiftId", (q) => q.eq("shiftId", openShift._id))
        .collect();

      for (const line of saleLines) {
        const product = await ctx.db.get(line.productId);
        if (!product || product.type !== "RETAIL") continue;
        reservedByProduct.set(
          line.productId,
          (reservedByProduct.get(line.productId) ?? 0) + line.qty,
        );
      }
    }

    const showCost = isAdmin(role) || isSuperAdmin(role);

    const suppliers = await ctx.db
      .query("suppliers")
      .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
      .collect();
    const supplierNameById = new Map(
      suppliers.map((supplier) => [String(supplier._id), supplier.name]),
    );

    const suppliersByProduct = new Map<
      string,
      Array<{ supplierId: Id<"suppliers">; supplierName: string }>
    >();

    for (const product of retailProducts) {
      const links = await ctx.db
        .query("supplierProducts")
        .withIndex("by_productId", (q) => q.eq("productId", product._id))
        .collect();

      const assigned: Array<{
        supplierId: Id<"suppliers">;
        supplierName: string;
      }> = [];

      for (const link of links) {
        if (link.businessId !== businessId) continue;
        const name =
          supplierNameById.get(String(link.supplierId)) ??
          (await ctx.db.get(link.supplierId))?.name ??
          "—";
        assigned.push({
          supplierId: link.supplierId,
          supplierName: name,
        });
      }

      assigned.sort((a, b) => a.supplierName.localeCompare(b.supplierName));
      suppliersByProduct.set(String(product._id), assigned);
    }

    const results = [];
    for (const product of retailProducts) {
      const productBatches = (batchesByProduct.get(product._id) ?? []).sort(
        (a, b) => a.createdAt - b.createdAt,
      );

      const batches = [];
      for (const batch of productBatches) {
        batches.push({
          batchId: batch._id,
          qty: batch.qty,
          qtyRemaining: batch.qtyRemaining,
          ...(showCost ? { unitCost: batch.unitCost } : {}),
          expiresAt: batch.expiresAt,
          receivedAt: batch.createdAt,
          supplierName: await supplierName(batch.supplierId),
        });
      }

      const qtyOnHand = batches.reduce((sum, batch) => sum + batch.qtyRemaining, 0);
      const reservedQty = reservedByProduct.get(product._id) ?? 0;
      const qtyEstimated = Math.max(0, qtyOnHand - reservedQty);

      const nearestExpiresAt = batches
        .filter((batch) => batch.expiresAt != null)
        .map((batch) => batch.expiresAt!)
        .sort((a, b) => a - b)[0];

      const stockAlert =
        qtyEstimated <= 0 ? ("empty" as const) : qtyEstimated <= LOW_STOCK_THRESHOLD ? ("low" as const) : ("ok" as const);

      const category = await resolveProductCategory(ctx, product);
      const assignedSuppliers = suppliersByProduct.get(String(product._id)) ?? [];

      results.push({
        productId: product._id,
        productName: product.name,
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        suppliers: assignedSuppliers,
        unit: product.unit,
        sellPrice: product.sellPrice,
        trackExpiry: product.trackExpiry ?? false,
        qtyOnHand,
        reservedQty,
        qtyEstimated,
        nearestExpiresAt,
        stockAlert,
        batches,
      });
    }

    return {
      hasOpenShift: openShift != null,
      products: results,
    };
  },
});

export const getSupplierCostHistory = query({
  args: {
    sessionToken: v.string(),
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!hasAcl(role, "master_produk")) return [];

    const product = await ctx.db.get(args.productId);
    if (!product) return [];

    await assertBusinessAccess(ctx, user, role, product.businessId);

    const history = await ctx.db
      .query("supplierCostHistory")
      .withIndex("by_productId", (q) => q.eq("productId", args.productId))
      .collect();

    const enriched = [];
    for (const entry of history.sort((a, b) => b.effectiveAt - a.effectiveAt)) {
      const supplier = await ctx.db.get(entry.supplierId);
      enriched.push({
        ...entry,
        supplierName: supplier?.name ?? "—",
      });
    }

    return enriched;
  },
});

export const updateStockBatchExpiry = mutation({
  args: {
    sessionToken: v.string(),
    batchId: v.id("stockReceiptItems"),
    expiresAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!hasAcl(role, "kasir") && !hasAcl(role, "master_produk")) {
      throw new Error("FORBIDDEN");
    }

    const batch = await ctx.db.get(args.batchId);
    if (!batch) {
      throw new Error("BATCH_NOT_FOUND");
    }

    await assertBusinessAccess(ctx, user, role, batch.businessId);

    const product = await ctx.db.get(batch.productId);
    if (!product || product.businessId !== batch.businessId) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    if (
      args.expiresAt !== undefined &&
      args.expiresAt !== null &&
      args.expiresAt <= 0
    ) {
      throw new Error("INVALID_EXPIRY");
    }

    if (product.trackExpiry && args.expiresAt === null) {
      throw new Error("EXPIRY_REQUIRED");
    }

    await ctx.db.patch(args.batchId, {
      expiresAt: args.expiresAt === null ? undefined : args.expiresAt,
    });

    return { batchId: args.batchId };
  },
});
