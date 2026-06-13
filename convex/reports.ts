import { query } from "./_generated/server";
import { v } from "convex/values";
import {
  assertBusinessAccess,
  resolveScopedBusinessId,
} from "./lib/businessContext";
import { getAuthenticatedUser, hasAcl } from "./lib/rbac";
import { getActiveUnitCostForProduct } from "./lib/inventoryCostHelpers";
import { aggregateDailyRollupsFromSaleLines } from "./lib/shiftReportHelpers";
import {
  findShiftAtTimestamp,
  resolvePriceKind,
} from "./lib/productPriceHistoryHelpers";
import { formatDateKey } from "./lib/shiftHelpers";

export const getDailyRollups = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!hasAcl(role, "kasir")) return [];

    const businessId = await resolveScopedBusinessId(
      ctx,
      user,
      role,
      args.businessId,
    );
    if (!businessId) return [];

    await assertBusinessAccess(ctx, user, role, businessId);

    const dayLimit = args.days ?? 30;
    return aggregateDailyRollupsFromSaleLines(ctx, businessId, dayLimit);
  },
});

export const getMonthlyComparison = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!hasAcl(role, "kasir")) {
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

    const lines = await ctx.db
      .query("saleLines")
      .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
      .collect();

    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;

    let thisMonth = 0;
    let lastMonthTotal = 0;

    for (const line of lines) {
      if (line.paymentStatus !== "PAID") continue;
      const dateKey = formatDateKey(line.paidAt ?? line.createdAt);
      if (dateKey.startsWith(thisMonthKey)) {
        thisMonth += line.lineTotal;
      } else if (dateKey.startsWith(lastMonthKey)) {
        lastMonthTotal += line.lineTotal;
      }
    }

    return { thisMonth, lastMonth: lastMonthTotal };
  },
});

export const getExpiringBatches = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
    withinDays: v.optional(v.number()),
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

    const withinDays = args.withinDays ?? 30;
    const cutoff = Date.now() + withinDays * 24 * 60 * 60 * 1000;

    const batches = await ctx.db
      .query("stockReceiptItems")
      .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
      .collect();

    const results = [];
    for (const batch of batches) {
      if (batch.qtyRemaining <= 0 || !batch.expiresAt) continue;
      if (batch.expiresAt > cutoff) continue;

      const product = await ctx.db.get(batch.productId);
      results.push({
        productId: batch.productId,
        productName: product?.name ?? "—",
        qtyRemaining: batch.qtyRemaining,
        expiresAt: batch.expiresAt,
        unitCost: batch.unitCost,
      });
    }

    return results.sort((a, b) => (a.expiresAt ?? 0) - (b.expiresAt ?? 0));
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
