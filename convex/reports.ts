import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  assertBusinessAccess,
  resolveScopedBusinessId,
} from "./lib/businessContext";
import { getAuthenticatedUser, hasAcl, isAdmin, isSuperAdmin } from "./lib/rbac";
import { getActiveUnitCostForProduct } from "./lib/inventoryCostHelpers";
import {
  aggregateDailyRollupsFromShiftSummaries,
  aggregateMonthlyRevenueFromShiftSummaries,
  aggregateTopSellingProductsFromShiftSummaries,
  aggregateTopSpendingGroupsFromSaleLines,
  rollingSaleDateRange,
  type SaleDateRange,
} from "./lib/shiftReportHelpers";
import {
  findShiftAtTimestamp,
  resolvePriceKind,
} from "./lib/productPriceHistoryHelpers";
import { getOpenShiftForBusiness } from "./lib/shiftHelpers";

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
    return aggregateDailyRollupsFromShiftSummaries(ctx, businessId, range);
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
    return aggregateTopSellingProductsFromShiftSummaries(
      ctx,
      businessId,
      range,
      args.limit ?? 10,
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
    return aggregateTopSpendingGroupsFromSaleLines(
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

    return aggregateMonthlyRevenueFromShiftSummaries(
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
    const cutoff =
      args.withinDays != null
        ? Date.now() + args.withinDays * 24 * 60 * 60 * 1000
        : null;

    const batches = await ctx.db
      .query("stockReceiptItems")
      .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
      .collect();

    const results = [];
    for (const batch of batches) {
      if (batch.qtyRemaining <= 0 || !batch.expiresAt) continue;
      if (cutoff != null && batch.expiresAt > cutoff) continue;

      const product = await ctx.db.get(batch.productId);
      results.push({
        productId: batch.productId,
        productName: product?.name ?? "—",
        qtyRemaining: batch.qtyRemaining,
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

    const products = await ctx.db
      .query("products")
      .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
      .collect();

    const results = [];
    for (const product of products) {
      if (!product.isActive || product.type !== "RETAIL") continue;

      const qtyOnHand = stockByProduct.get(product._id) ?? 0;
      if (qtyOnHand > maxQty) continue;

      results.push({
        productId: product._id,
        productName: product.name,
        unit: product.unit,
        qtyOnHand,
        trackExpiry: product.trackExpiry ?? false,
      });
    }

    return results.sort((a, b) => {
      if (a.qtyOnHand !== b.qtyOnHand) return a.qtyOnHand - b.qtyOnHand;
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

      results.push({
        productId: product._id,
        productName: product.name,
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
