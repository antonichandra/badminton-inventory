import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertBusinessAccess, resolveScopedBusinessId } from "./lib/businessContext";
import { getAuthenticatedUser, hasAcl, isAdmin, isSuperAdmin } from "./lib/rbac";
import {
  buildStockCardFormItems,
  computeStockCardItemResult,
  requireOpenShiftForStockCard,
} from "./lib/stockCardHelpers";

export const getStockCardFormContext = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!hasAcl(role, "kasir")) return null;

    const businessId = await resolveScopedBusinessId(
      ctx,
      user,
      role,
      args.businessId,
    );
    if (!businessId) return null;

    await assertBusinessAccess(ctx, user, role, businessId);

    const shift = await requireOpenShiftForStockCard(ctx, businessId).catch(
      () => null,
    );
    if (!shift) return null;

    const business = await ctx.db.get(businessId);
    const items = await buildStockCardFormItems(ctx, shift);

    return {
      shiftId: shift._id,
      shiftOpenedAt: shift.openedAt,
      businessName: business?.name ?? "—",
      items,
      canExportPdf: isAdmin(role) || isSuperAdmin(role),
    };
  },
});

const stockCardItemInput = v.object({
  productId: v.id("products"),
  countedQty: v.number(),
});

export const getStockCardPageData = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!hasAcl(role, "kasir")) return null;

    const businessId = await resolveScopedBusinessId(
      ctx,
      user,
      role,
      args.businessId,
    );
    if (!businessId) return null;

    await assertBusinessAccess(ctx, user, role, businessId);

    const shift = await requireOpenShiftForStockCard(ctx, businessId).catch(
      () => null,
    );
    if (!shift) return null;

    const business = await ctx.db.get(businessId);
    const items = await buildStockCardFormItems(ctx, shift);

    const rawSnapshots = await ctx.db
      .query("stockCardSnapshots")
      .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
      .collect();

    const snapshots = [];
    for (const snapshot of rawSnapshots.sort(
      (a, b) => a.recordedAt - b.recordedAt,
    )) {
      const recorder = await ctx.db.get(snapshot.recordedBy);
      const itemsByProduct: Record<
        string,
        {
          countedQty: number;
          missInputQty: number;
          overInputQty: number;
        }
      > = {};

      for (const item of snapshot.items) {
        itemsByProduct[item.productId] = {
          countedQty: item.countedQty,
          missInputQty: item.missInputQty,
          overInputQty: item.overInputQty,
        };
      }

      snapshots.push({
        _id: snapshot._id,
        recordedAt: snapshot.recordedAt,
        recordedByName: recorder?.name ?? "—",
        note: snapshot.note,
        itemsByProduct,
      });
    }

    return {
      shiftId: shift._id,
      shiftOpenedAt: shift.openedAt,
      businessName: business?.name ?? "—",
      items,
      snapshots,
      canExportPdf: isAdmin(role) || isSuperAdmin(role),
    };
  },
});

export const listStockCardSnapshots = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
    shiftId: v.optional(v.id("shifts")),
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

    let shiftId = args.shiftId;
    if (!shiftId) {
      const shift = await requireOpenShiftForStockCard(ctx, businessId).catch(
        () => null,
      );
      if (!shift) return [];
      shiftId = shift._id;
    }

    const snapshots = await ctx.db
      .query("stockCardSnapshots")
      .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId!))
      .collect();

    const enriched = [];
    for (const snapshot of snapshots.sort(
      (a, b) => b.recordedAt - a.recordedAt,
    )) {
      const recorder = await ctx.db.get(snapshot.recordedBy);
      enriched.push({
        ...snapshot,
        recordedByName: recorder?.name ?? "—",
      });
    }

    return enriched;
  },
});

export const submitStockCardSnapshot = mutation({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
    items: v.array(stockCardItemInput),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!hasAcl(role, "kasir")) {
      throw new Error("FORBIDDEN");
    }

    const businessId = await resolveScopedBusinessId(
      ctx,
      user,
      role,
      args.businessId,
    );
    if (!businessId) throw new Error("NO_ACTIVE_BUSINESS");

    await assertBusinessAccess(ctx, user, role, businessId);

    const shift = await requireOpenShiftForStockCard(ctx, businessId);
    const formItems = await buildStockCardFormItems(ctx, shift);
    const formItemMap = new Map(formItems.map((item) => [item.productId, item]));

    const snapshotItems = [];
    let missInputQtyTotal = 0;
    let overInputQtyTotal = 0;

    for (const input of args.items) {
      if (input.countedQty < 0) {
        throw new Error("INVALID_COUNTED_QTY");
      }

      const formItem = formItemMap.get(input.productId);
      if (!formItem) {
        throw new Error("PRODUCT_NOT_IN_SHIFT");
      }

      const result = computeStockCardItemResult(formItem, input.countedQty);
      missInputQtyTotal += result.missInputQty;
      overInputQtyTotal += result.overInputQty;
      snapshotItems.push(result);
    }

    if (snapshotItems.length === 0) {
      throw new Error("NO_ITEMS");
    }

    const now = Date.now();
    const snapshotId = await ctx.db.insert("stockCardSnapshots", {
      businessId,
      shiftId: shift._id,
      recordedBy: user._id,
      recordedAt: now,
      note: args.note?.trim() || undefined,
      missInputQtyTotal,
      overInputQtyTotal,
      items: snapshotItems,
      createdAt: now,
    });

    return { snapshotId, missInputQtyTotal, overInputQtyTotal };
  },
});

export const getStockCardExportData = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!isAdmin(role) && !isSuperAdmin(role)) {
      throw new Error("FORBIDDEN");
    }

    const businessId = await resolveScopedBusinessId(
      ctx,
      user,
      role,
      args.businessId,
    );
    if (!businessId) throw new Error("NO_ACTIVE_BUSINESS");

    await assertBusinessAccess(ctx, user, role, businessId);

    const shift = await requireOpenShiftForStockCard(ctx, businessId);
    const business = await ctx.db.get(businessId);
    const items = await buildStockCardFormItems(ctx, shift);

    return {
      businessName: business?.name ?? "—",
      shiftOpenedAt: shift.openedAt,
      items,
    };
  },
});
