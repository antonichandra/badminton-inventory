import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  cashEntryType,
  paymentMethod,
  supplierPaymentStatus,
} from "./schema";
import {
  assertBusinessAccess,
  assertCanManageShift,
  canManageShift,
  getAccessibleBusinesses,
  getKasirBusinessContext,
  resolveScopedBusinessId,
} from "./lib/businessContext";
import {
  updateDailyRollups,
} from "./lib/shiftReportHelpers";
import { getRoleById } from "./lib/authHelpers";
import { parseGroupLabel } from "./lib/groupLabelHelpers";
import {
  assertAcl,
  getAuthenticatedUser,
  hasAcl,
  isAdmin,
  isSuperAdmin,
} from "./lib/rbac";
import { resolveReceiptUnitCost } from "./lib/inventoryCostHelpers";
import {
  buildPhysicalSalesByPriceTier,
  computeClosePreview,
  computePhysicalTotalRevenue,
  estimatePhysicalCogsForShift,
  finalizeShiftClose,
  getSuggestedOpeningStock as loadSuggestedOpeningStock,
  hasShiftClosingStockCount,
  shouldRebuildClosedPhysicalTiers,
} from "./lib/shiftCloseHelpers";
import {
  loadShiftCashEntries,
  loadShiftStockReceipts,
  loadShiftWriteOffs,
} from "./lib/shiftDetailHelpers";
import { createOpeningBalanceBatch } from "./lib/openingStockHelpers";
import { assertProductsLinkedToSupplier } from "./lib/supplierProductHelpers";
import {
  calculateLineTotal,
  computeImpliedRevenue,
  ensureShiftStockSnapshot,
  generatePaymentBatchId,
  getOpenShiftForBusiness,
  getShiftCashSummary,
  getShiftSalesStats,
  getShiftStockReconciliation,
  getShiftStockSummary,
  getWritableOpenShiftForBusiness,
  isValidShiftAssignee,
  resolveShiftAssignees,
  sumStockMovementsByProduct,
} from "./lib/shiftHelpers";
import { resolveProductCategory } from "./lib/productCategoryHelpers";

const openingStockItem = v.object({
  productId: v.id("products"),
  qty: v.number(),
});

const closingStockItem = v.object({
  productId: v.id("products"),
  qty: v.number(),
});

const receiptItem = v.object({
  productId: v.id("products"),
  qty: v.number(),
  unitCost: v.optional(v.number()),
  expiresAt: v.optional(v.number()),
});

async function requireOpenShiftContext(
  ctx: Parameters<typeof getKasirBusinessContext>[0],
  sessionToken: string,
) {
  const context = await getKasirBusinessContext(ctx, sessionToken);
  if (!context.activeBusinessId) {
    throw new Error("NO_ACTIVE_BUSINESS");
  }

  const shift = await getOpenShiftForBusiness(ctx, context.activeBusinessId);
  if (!shift) {
    throw new Error("NO_OPEN_SHIFT");
  }

  await assertBusinessAccess(
    ctx,
    context.user,
    context.role,
    context.activeBusinessId,
  );

  return {
    ...context,
    shift,
    businessId: context.activeBusinessId,
    role: context.role,
  };
}

async function requireWritableShiftContext(
  ctx: Parameters<typeof getKasirBusinessContext>[0],
  sessionToken: string,
) {
  const context = await requireOpenShiftContext(ctx, sessionToken);
  if (context.shift.status !== "OPEN") {
    throw new Error("SHIFT_CLOSE_PENDING");
  }
  return context;
}

async function tryOpenShiftContext(
  ctx: Parameters<typeof getKasirBusinessContext>[0],
  sessionToken: string,
) {
  try {
    const context = await getKasirBusinessContext(ctx, sessionToken);
    if (!context.activeBusinessId) return null;

    const shift = await getWritableOpenShiftForBusiness(
      ctx,
      context.activeBusinessId,
    );
    if (!shift) return null;

    await assertBusinessAccess(
      ctx,
      context.user,
      context.role,
      context.activeBusinessId,
    );

    return {
      ...context,
      shift,
      businessId: context.activeBusinessId,
      role: context.role,
    };
  } catch {
    return null;
  }
}

export const getKasirContext = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args) => {
    try {
      const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
      if (!hasAcl(role, "kasir")) {
        return {
          businesses: [],
          activeBusinessId: null,
          openShift: null,
          shiftStatus: null,
          closeRequest: null,
          pendingCloseCount: 0,
          canManageShift: false,
          assignedStaff: null,
        };
      }

      const businesses = await getAccessibleBusinesses(ctx, user, role);
      const activeBusinessId = await resolveScopedBusinessId(
        ctx,
        user,
        role,
        args.businessId,
      );
      const shift = activeBusinessId
        ? await getOpenShiftForBusiness(ctx, activeBusinessId)
        : null;

      const canManage = activeBusinessId
        ? await canManageShift(ctx, user, role, activeBusinessId)
        : false;

      const closeRequest = shift
        ? await ctx.db
            .query("shiftCloseRequests")
            .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
            .filter((q) => q.eq(q.field("status"), "PENDING"))
            .first()
        : null;

      const pendingCloseCount =
        activeBusinessId && canManage
          ? (
              await ctx.db
                .query("shiftCloseRequests")
                .withIndex("by_business_and_status", (q) =>
                  q.eq("businessId", activeBusinessId).eq("status", "PENDING"),
                )
                .collect()
            ).length
          : 0;

      let assignedStaff: {
        id: string;
        name: string;
        email: string;
        picture?: string;
        roleName: string;
      } | null = null;
      const onDutyUserId = shift?.assignedStaffId ?? shift?.openedBy;
      if (onDutyUserId) {
        const staffUser = await ctx.db.get(onDutyUserId);
        if (staffUser) {
          const staffRole = await getRoleById(ctx, staffUser.roleId);
          assignedStaff = {
            id: staffUser._id,
            name: staffUser.name,
            email: staffUser.email,
            picture: staffUser.picture,
            roleName: staffRole?.name ?? "STAFF",
          };
        }
      }

      return {
        businesses: businesses.map((business) => ({
          _id: business._id,
          name: business.name,
        })),
        activeBusinessId,
        openShift: shift,
        shiftStatus: shift?.status ?? null,
        closeRequest,
        pendingCloseCount,
        canManageShift: canManage,
        assignedStaff,
      };
    } catch (error) {
      console.error("getKasirContext failed:", error);
      return {
        businesses: [],
        activeBusinessId: null,
        openShift: null,
        shiftStatus: null,
        closeRequest: null,
        pendingCloseCount: 0,
        canManageShift: false,
        assignedStaff: null,
      };
    }
  },
});

export const listShiftAssignees = query({
  args: {
    sessionToken: v.string(),
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    await assertBusinessAccess(ctx, user, role, args.businessId);

    const assignees = await resolveShiftAssignees(ctx, args.businessId);
    const usesOwnerFallback =
      assignees.length > 0 &&
      assignees.every((assignee) => assignee.businessRole === "OWNER");

    return { assignees, usesOwnerFallback };
  },
});

export const getShiftStockContext = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const context = await tryOpenShiftContext(ctx, args.sessionToken);
    if (!context) return [];
    const { shift } = context;

    const snapshots = await ctx.db
      .query("shiftStockSnapshots")
      .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
      .collect();

    const items = [];
    for (const snapshot of snapshots) {
      const product = await ctx.db.get(snapshot.productId);
      if (!product || product.type !== "RETAIL") continue;

      const received = await sumStockMovementsByProduct(
        ctx,
        shift._id,
        snapshot.productId,
        "RECEIPT",
      );
      const writeOff = await sumStockMovementsByProduct(
        ctx,
        shift._id,
        snapshot.productId,
        "WRITEOFF",
      );

      items.push({
        productId: snapshot.productId,
        productName: product.name,
        unit: product.unit,
        ...(await resolveProductCategory(ctx, product)),
        openingQty: snapshot.openingQty,
        receivedQty: received,
        writeOffQty: writeOff,
      });
    }

    return items.sort((a, b) => a.productName.localeCompare(b.productName));
  },
});

export const getShiftCashPreview = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const context = await tryOpenShiftContext(ctx, args.sessionToken);
    if (!context) return null;
    return getShiftCashSummary(ctx, context.shift);
  },
});

export const getShiftLiveStats = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const context = await tryOpenShiftContext(ctx, args.sessionToken);
    if (!context) return null;
    const { shift, businessId, role } = context;
    const salesStats = await getShiftSalesStats(ctx, shift._id);
    const cashSummary = await getShiftCashSummary(ctx, shift);
    const stockReconciliation = await getShiftStockReconciliation(
      ctx,
      shift._id,
    );
    const usePhysical = await hasShiftClosingStockCount(ctx, shift._id);
    const liveAsOf = Date.now();
    const recordedRevenue = salesStats.paidRevenue;
    const impliedRevenue = usePhysical
      ? Math.max(
          0,
          (await computePhysicalTotalRevenue(
            ctx,
            shift._id,
            businessId,
            stockReconciliation,
            liveAsOf,
          )) - recordedRevenue,
        )
      : await computeImpliedRevenue(ctx, shift._id);
    const totalRevenue = usePhysical
      ? await computePhysicalTotalRevenue(
          ctx,
          shift._id,
          businessId,
          stockReconciliation,
          liveAsOf,
        )
      : recordedRevenue + impliedRevenue;
    const showProfitDetail =
      isAdmin(role) || isSuperAdmin(role);

    const cashEntries = await loadShiftCashEntries(ctx, shift._id);
    const writeOffs = await loadShiftWriteOffs(ctx, shift._id);

    const salesByPriceTier = usePhysical
      ? await buildPhysicalSalesByPriceTier(
          ctx,
          shift._id,
          businessId,
          stockReconciliation,
          showProfitDetail,
          liveAsOf,
        )
      : salesStats.salesByPriceTier;

    const topProducts = usePhysical
      ? salesByPriceTier
          .map((tier) => ({
            productId: tier.productId,
            productName: tier.productName,
            categoryId: tier.categoryId,
            categoryName: tier.categoryName,
            qty: tier.qty,
            revenue: tier.revenue,
            ...(showProfitDetail
              ? {
                  cogs: tier.cogs,
                  unitCost: tier.unitCost,
                  grossProfit: tier.grossProfit,
                }
              : {}),
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10)
      : showProfitDetail
        ? salesStats.topProducts
        : salesStats.topProducts.map(
            ({ cogs, grossProfit, unitCost, ...rest }) => rest,
          );

    const physicalCogs = usePhysical
      ? await estimatePhysicalCogsForShift(
          ctx,
          businessId,
          shift._id,
          stockReconciliation,
        )
      : undefined;

    return {
      paidRevenue: recordedRevenue,
      unpaidRevenue: salesStats.unpaidRevenue,
      recordedRevenue,
      impliedRevenue,
      totalRevenue,
      cashIncome: cashSummary.cashIncome,
      cashSummary,
      cashEntries,
      writeOffs,
      topProducts,
      salesByPriceTier: showProfitDetail
        ? salesByPriceTier
        : salesByPriceTier.map(({ cogs, grossProfit, unitCost, ...rest }) => rest),
      ...(showProfitDetail
        ? {
            grossProfit: usePhysical
              ? totalRevenue - (physicalCogs ?? 0)
              : salesStats.estimatedGrossProfit,
            totalCogs: usePhysical
              ? physicalCogs
              : salesStats.estimatedTotalCogs,
          }
        : {}),
    };
  },
});

export const getShiftSummary = query({
  args: {
    sessionToken: v.string(),
    shiftId: v.id("shifts"),
  },
  handler: async (ctx, args) => {
    const { user, role, activeBusinessId } = await getKasirBusinessContext(
      ctx,
      args.sessionToken,
    );
    if (!activeBusinessId) throw new Error("NO_ACTIVE_BUSINESS");

    const shift = await ctx.db.get(args.shiftId);
    if (!shift || shift.businessId !== activeBusinessId) {
      throw new Error("SHIFT_NOT_FOUND");
    }

    await assertBusinessAccess(ctx, user, role, activeBusinessId);

    const saved = await ctx.db
      .query("shiftSummaries")
      .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
      .unique();

    if (saved) {
      const cashSummary = await getShiftCashSummary(ctx, shift);
      const showProfitDetail = isAdmin(role) || isSuperAdmin(role);
      return {
        shift,
        summary: saved,
        cashSummary,
        totalRevenue: saved.totalRevenue,
        ...(showProfitDetail ? { grossProfit: saved.grossProfit } : {}),
      };
    }

    const salesStats = await getShiftSalesStats(ctx, shift._id);
    const stockSummary = await getShiftStockSummary(ctx, shift._id);
    const cashSummary = await getShiftCashSummary(ctx, shift);
    const showProfitDetail = isAdmin(role) || isSuperAdmin(role);

    return {
      shift,
      stockSummary,
      salesByPriceTier: salesStats.salesByPriceTier,
      cashSummary,
      totalRevenue: salesStats.paidRevenue,
      ...(showProfitDetail ? { grossProfit: salesStats.grossProfit } : {}),
    };
  },
});

export const getShiftDetail = query({
  args: {
    sessionToken: v.string(),
    shiftId: v.id("shifts"),
  },
  handler: async (ctx, args) => {
    const { user, role, activeBusinessId } = await getKasirBusinessContext(
      ctx,
      args.sessionToken,
    );
    if (!activeBusinessId) throw new Error("NO_ACTIVE_BUSINESS");

    const shift = await ctx.db.get(args.shiftId);
    if (!shift || shift.businessId !== activeBusinessId) {
      throw new Error("SHIFT_NOT_FOUND");
    }

    await assertBusinessAccess(ctx, user, role, activeBusinessId);

    const saved = await ctx.db
      .query("shiftSummaries")
      .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
      .unique();

    const cashSummary = await getShiftCashSummary(ctx, shift);
    const cashEntries = await loadShiftCashEntries(ctx, shift._id);
    const stockReceipts = await loadShiftStockReceipts(ctx, shift._id);
    const writeOffs = await loadShiftWriteOffs(ctx, shift._id);

    const assignedStaff = shift.assignedStaffId
      ? await ctx.db.get(shift.assignedStaffId)
      : null;
    const closedByUser = shift.closedBy ? await ctx.db.get(shift.closedBy) : null;

    let stockReconciliation = saved?.stockReconciliation ?? [];
    let totalRevenue = saved?.totalRevenue ?? 0;
    let totalCogs = saved?.totalCogs ?? 0;
    let grossProfit = saved?.grossProfit ?? 0;

    if (!saved) {
      const salesStats = await getShiftSalesStats(ctx, shift._id);
      stockReconciliation = await getShiftStockReconciliation(ctx, shift._id);
      totalRevenue = salesStats.paidRevenue;
      totalCogs = salesStats.totalCogs;
      grossProfit = salesStats.grossProfit;
    }

    const showProfitDetail = isAdmin(role) || isSuperAdmin(role);
    const salesStats = await getShiftSalesStats(ctx, shift._id);

    let salesByPriceTier;
    if (saved && shift.status === "CLOSED") {
      const closedAsOf = shift.closedAt ?? saved.closedAt;
      const needsPhysicalRebuild = shouldRebuildClosedPhysicalTiers(
        saved.salesByPriceTier,
        stockReconciliation,
      );

      if (!needsPhysicalRebuild && saved.salesByPriceTier.length > 0) {
        salesByPriceTier = showProfitDetail
          ? saved.salesByPriceTier
          : saved.salesByPriceTier.map(
              ({ cogs, grossProfit, ...rest }) => rest,
            );
      } else if (stockReconciliation.length > 0) {
        const physicalTiers = await buildPhysicalSalesByPriceTier(
          ctx,
          shift._id,
          activeBusinessId,
          stockReconciliation,
          showProfitDetail,
          closedAsOf,
        );
        salesByPriceTier = showProfitDetail
          ? physicalTiers
          : physicalTiers.map(({ cogs, grossProfit, unitCost, ...rest }) => rest);
      } else {
        salesByPriceTier = showProfitDetail
          ? salesStats.salesByPriceTier
          : salesStats.salesByPriceTier.map(
              ({ cogs, grossProfit, ...rest }) => rest,
            );
      }
    } else {
      const usePhysical =
        saved != null && stockReconciliation.length > 0;
      const physicalTiers = usePhysical
        ? await buildPhysicalSalesByPriceTier(
            ctx,
            shift._id,
            activeBusinessId,
            stockReconciliation,
            showProfitDetail,
            Date.now(),
          )
        : null;

      salesByPriceTier = physicalTiers
        ? showProfitDetail
          ? physicalTiers
          : physicalTiers.map(({ cogs, grossProfit, unitCost, ...rest }) => rest)
        : showProfitDetail
          ? salesStats.salesByPriceTier
          : salesStats.salesByPriceTier.map(
              ({ cogs, grossProfit, ...rest }) => rest,
            );
    }

    const displayGrossProfit = saved
      ? grossProfit
      : salesStats.estimatedGrossProfit;

    return {
      shift,
      summary: saved,
      cashSummary,
      cashEntries,
      stockReceipts,
      writeOffs,
      stockReconciliation,
      salesByPriceTier,
      totalRevenue,
      ...(showProfitDetail
        ? {
            totalCogs: saved ? totalCogs : salesStats.estimatedTotalCogs,
            grossProfit: displayGrossProfit,
          }
        : {}),
      assignedStaffName: assignedStaff?.name ?? null,
      closedByName: closedByUser?.name ?? null,
    };
  },
});

export const listShiftSummaries = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    const businessId = await resolveScopedBusinessId(
      ctx,
      user,
      role,
      args.businessId,
    );
    if (!businessId) return [];

    await assertBusinessAccess(ctx, user, role, businessId);

    const summaries = await ctx.db
      .query("shiftSummaries")
      .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
      .collect();

    const showProfitDetail = isAdmin(role) || isSuperAdmin(role);

    return summaries
      .sort((a, b) => b.closedAt - a.closedAt)
      .slice(0, args.limit ?? 20)
      .map((summary) => {
        if (showProfitDetail) return summary;
        const {
          totalCogs: _totalCogs,
          grossProfit: _grossProfit,
          salesByPriceTier,
          topProducts,
          ...rest
        } = summary;
        return {
          ...rest,
          salesByPriceTier: salesByPriceTier.map(
            ({ cogs, grossProfit, ...tier }) => tier,
          ),
          topProducts: topProducts.map(
            ({ cogs, grossProfit, ...product }) => product,
          ),
        };
      });
  },
});

export const listSaleLines = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const context = await tryOpenShiftContext(ctx, args.sessionToken);
    if (!context) {
      return { lines: [] };
    }
    const { shift, businessId } = context;

    const lines = await ctx.db
      .query("saleLines")
      .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
      .collect();

    const enriched = [];
    for (const line of lines.sort((a, b) => b.createdAt - a.createdAt)) {
      const product = await ctx.db.get(line.productId);
      enriched.push({
        ...line,
        productName: product?.name ?? "—",
        productType: product?.type ?? "RETAIL",
        productUnit: product?.unit ?? "",
      });
    }

    return { shiftId: shift._id, businessId, lines: enriched };
  },
});

export const getPaymentBatchReceipt = query({
  args: {
    sessionToken: v.string(),
    batchId: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, role, activeBusinessId } = await getKasirBusinessContext(
      ctx,
      args.sessionToken,
    );
    if (!activeBusinessId) throw new Error("NO_ACTIVE_BUSINESS");

    const batch = await ctx.db
      .query("paymentBatches")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .unique();

    if (!batch || batch.businessId !== activeBusinessId) {
      throw new Error("BATCH_NOT_FOUND");
    }

    await assertBusinessAccess(ctx, user, role, activeBusinessId);

    const business = await ctx.db.get(batch.businessId);
    const recorder = await ctx.db.get(batch.recordedBy);
    const sport = business ? await ctx.db.get(business.sportId) : null;

    const lines = await ctx.db
      .query("saleLines")
      .withIndex("by_paymentBatchId", (q) =>
        q.eq("paymentBatchId", args.batchId),
      )
      .collect();

    const enriched = [];
    for (const line of lines) {
      const product = await ctx.db.get(line.productId);
      enriched.push({
        productName: product?.name ?? "—",
        qty: line.qty,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
        rentalHours: line.rentalHours,
        rentalDescription: line.rentalDescription,
      });
    }

    return {
      batch,
      business: business
        ? { name: business.name, address: business.address, phone: business.phone }
        : null,
      sport: sport ? { slug: sport.slug, name: sport.name } : null,
      recordedByName: recorder?.name ?? "—",
      lines: enriched,
    };
  },
});

export const getShiftExportData = query({
  args: {
    sessionToken: v.string(),
    shiftId: v.id("shifts"),
  },
  handler: async (ctx, args) => {
    const { user, role, activeBusinessId } = await getKasirBusinessContext(
      ctx,
      args.sessionToken,
    );
    if (!activeBusinessId) throw new Error("NO_ACTIVE_BUSINESS");

    const shift = await ctx.db.get(args.shiftId);
    if (!shift || shift.businessId !== activeBusinessId) {
      throw new Error("SHIFT_NOT_FOUND");
    }

    await assertBusinessAccess(ctx, user, role, activeBusinessId);

    const summary = await ctx.db
      .query("shiftSummaries")
      .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
      .unique();

    const lines = await ctx.db
      .query("saleLines")
      .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
      .collect();

    const enrichedLines = [];
    for (const line of lines) {
      const product = await ctx.db.get(line.productId);
      const category = product
        ? await resolveProductCategory(ctx, product)
        : { categoryName: "—" as const };
      enrichedLines.push({
        productName: product?.name ?? "—",
        categoryName: category.categoryName,
        qty: line.qty,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
        paymentStatus: line.paymentStatus,
        paymentMethod: line.paymentMethod,
        cogsTotal: line.cogsTotal,
        paidAt: line.paidAt,
      });
    }

    const business = await ctx.db.get(activeBusinessId);
    const showProfitDetail = isAdmin(role) || isSuperAdmin(role);

    const redactedSummary = summary
      ? showProfitDetail
        ? summary
        : (() => {
            const {
              totalCogs: _totalCogs,
              grossProfit: _grossProfit,
              salesByPriceTier,
              topProducts,
              ...rest
            } = summary;
            return {
              ...rest,
              salesByPriceTier: salesByPriceTier.map(
                ({ cogs, grossProfit, ...tier }) => tier,
              ),
              topProducts: topProducts.map(
                ({ cogs, grossProfit, ...product }) => product,
              ),
            };
          })()
      : null;

    const redactedLines = showProfitDetail
      ? enrichedLines
      : enrichedLines.map(({ cogsTotal: _cogsTotal, ...line }) => line);

    return {
      shift,
      summary: redactedSummary,
      lines: redactedLines,
      businessName: business?.name ?? "—",
      includeProfit: showProfitDetail,
    };
  },
});

export const openShift = mutation({
  args: {
    sessionToken: v.string(),
    assignedStaffId: v.id("users"),
    openingCash: v.number(),
    openingStock: v.array(openingStockItem),
  },
  handler: async (ctx, args) => {
    const context = await getKasirBusinessContext(ctx, args.sessionToken);
    if (!context.activeBusinessId) {
      throw new Error("NO_ACTIVE_BUSINESS");
    }

    await assertCanManageShift(
      ctx,
      context.user,
      context.role,
      context.activeBusinessId,
    );

    const assigneeValid = await isValidShiftAssignee(
      ctx,
      context.activeBusinessId,
      args.assignedStaffId,
    );
    if (!assigneeValid) {
      throw new Error("INVALID_ASSIGNED_STAFF");
    }

    const assigneeUser = await ctx.db.get(args.assignedStaffId);
    if (!assigneeUser || assigneeUser.status !== "APPROVED") {
      throw new Error("INVALID_ASSIGNED_STAFF");
    }

    const existing = await getOpenShiftForBusiness(
      ctx,
      context.activeBusinessId,
    );
    if (existing) {
      throw new Error("SHIFT_ALREADY_OPEN");
    }

    if (args.openingCash < 0) {
      throw new Error("INVALID_CASH");
    }

    const retailProducts = await ctx.db
      .query("products")
      .withIndex("by_businessId", (q) =>
        q.eq("businessId", context.activeBusinessId!),
      )
      .collect();
    const activeRetailCount = retailProducts.filter(
      (product) => product.isActive && product.type === "RETAIL",
    ).length;
    if (activeRetailCount === 0) {
      throw new Error("NO_RETAIL_PRODUCTS");
    }

    const now = Date.now();
    const shiftId = await ctx.db.insert("shifts", {
      businessId: context.activeBusinessId,
      status: "OPEN",
      openedBy: context.user._id,
      assignedStaffId: args.assignedStaffId,
      openedAt: now,
      openingCash: args.openingCash,
      archiveStatus: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });

    for (const item of args.openingStock) {
      if (item.qty < 0) continue;
      const product = await ctx.db.get(item.productId);
      if (!product || product.businessId !== context.activeBusinessId) {
        continue;
      }
      if (product.type !== "RETAIL") continue;

      await ctx.db.insert("shiftStockSnapshots", {
        shiftId,
        productId: item.productId,
        openingQty: item.qty,
        createdAt: now,
        updatedAt: now,
      });

      if (item.qty > 0) {
        await createOpeningBalanceBatch(ctx, {
          shiftId,
          businessId: context.activeBusinessId,
          productId: item.productId,
          qty: item.qty,
          recordedBy: context.user._id,
        });
      }
    }

    return { shiftId };
  },
});

export const addSaleLine = mutation({
  args: {
    sessionToken: v.string(),
    productId: v.id("products"),
    qty: v.number(),
    rentalHours: v.optional(v.number()),
    rentalDescription: v.optional(v.string()),
    groupLabel: v.optional(v.string()),
    customerNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, shift, businessId } = await requireWritableShiftContext(
      ctx,
      args.sessionToken,
    );

    const product = await ctx.db.get(args.productId);
    if (!product || product.businessId !== businessId || !product.isActive) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    if (product.type === "RENTAL") {
      if (args.qty <= 0) {
        throw new Error("INVALID_QTY");
      }
      if ((args.rentalHours ?? 0) <= 0) {
        throw new Error("INVALID_RENTAL_HOURS");
      }
      if (!args.rentalDescription?.trim()) {
        throw new Error("RENTAL_DESCRIPTION_REQUIRED");
      }
    } else if (args.qty <= 0) {
      throw new Error("INVALID_QTY");
    }

    const now = Date.now();

    if (product.type === "RETAIL") {
      await ensureShiftStockSnapshot(ctx, shift._id, product._id, now);
    }

    const { unitPrice, lineTotal } = calculateLineTotal(
      product,
      args.qty,
      args.rentalHours,
    );

    const lineId = await ctx.db.insert("saleLines", {
      shiftId: shift._id,
      businessId,
      productId: product._id,
      groupLabel: parseGroupLabel(args.groupLabel),
      customerNote: args.customerNote?.trim() || undefined,
      rentalDescription: args.rentalDescription?.trim() || undefined,
      qty: args.qty,
      rentalHours: product.type === "RENTAL" ? args.rentalHours : undefined,
      unitPrice,
      lineTotal,
      paymentStatus: "UNPAID",
      recordedBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    return { lineId };
  },
});

export const updateSaleLine = mutation({
  args: {
    sessionToken: v.string(),
    lineId: v.id("saleLines"),
    productId: v.optional(v.id("products")),
    qty: v.optional(v.number()),
    rentalHours: v.optional(v.number()),
    rentalDescription: v.optional(v.string()),
    groupLabel: v.optional(v.string()),
    customerNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { shift, businessId } = await requireWritableShiftContext(
      ctx,
      args.sessionToken,
    );

    const line = await ctx.db.get(args.lineId);
    if (!line || line.shiftId !== shift._id) {
      throw new Error("SALE_LINE_NOT_FOUND");
    }
    if (line.paymentStatus === "PAID") {
      throw new Error("SALE_LINE_ALREADY_PAID");
    }

    const productId = args.productId ?? line.productId;
    const product = await ctx.db.get(productId);
    if (!product || product.businessId !== businessId) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    const qty = args.qty ?? line.qty;
    const rentalHours = args.rentalHours ?? line.rentalHours;
    const rentalDescription =
      args.rentalDescription ?? line.rentalDescription ?? undefined;

    if (product.type === "RENTAL") {
      if (qty <= 0) throw new Error("INVALID_QTY");
      if ((rentalHours ?? 0) <= 0) throw new Error("INVALID_RENTAL_HOURS");
      if (!rentalDescription?.trim()) {
        throw new Error("RENTAL_DESCRIPTION_REQUIRED");
      }
    } else if (qty <= 0) {
      throw new Error("INVALID_QTY");
    }

    const productChanged =
      args.productId != null && args.productId !== line.productId;

    let unitPrice: number;
    let lineTotal: number;
    if (productChanged) {
      ({ unitPrice, lineTotal } = calculateLineTotal(product, qty, rentalHours));
    } else if (product.type === "RENTAL") {
      unitPrice = line.unitPrice;
      lineTotal = unitPrice * qty * (rentalHours ?? 0);
    } else {
      unitPrice = line.unitPrice;
      lineTotal = unitPrice * qty;
    }

    await ctx.db.patch(args.lineId, {
      productId,
      qty,
      rentalHours: product.type === "RENTAL" ? rentalHours : undefined,
      rentalDescription:
        product.type === "RENTAL"
          ? (rentalDescription ?? "").trim()
          : undefined,
      groupLabel:
        args.groupLabel !== undefined
          ? parseGroupLabel(args.groupLabel)
          : line.groupLabel,
      customerNote:
        args.customerNote !== undefined
          ? args.customerNote.trim() || undefined
          : line.customerNote,
      unitPrice,
      lineTotal,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const deleteSaleLine = mutation({
  args: {
    sessionToken: v.string(),
    lineId: v.id("saleLines"),
  },
  handler: async (ctx, args) => {
    const { shift } = await requireWritableShiftContext(ctx, args.sessionToken);

    const line = await ctx.db.get(args.lineId);
    if (!line || line.shiftId !== shift._id) {
      throw new Error("SALE_LINE_NOT_FOUND");
    }
    if (line.paymentStatus === "PAID") {
      throw new Error("SALE_LINE_ALREADY_PAID");
    }

    await ctx.db.delete(args.lineId);
    return { success: true };
  },
});

export const paySaleLines = mutation({
  args: {
    sessionToken: v.string(),
    lineIds: v.array(v.id("saleLines")),
    paymentMethod: paymentMethod,
    amountReceived: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, shift } = await requireWritableShiftContext(
      ctx,
      args.sessionToken,
    );

    if (args.lineIds.length === 0) {
      throw new Error("NO_LINES_SELECTED");
    }

    const now = Date.now();
    const batchId = generatePaymentBatchId();
    let total = 0;

    for (const lineId of args.lineIds) {
      const line = await ctx.db.get(lineId);
      if (!line || line.shiftId !== shift._id) {
        throw new Error("SALE_LINE_NOT_FOUND");
      }
      if (line.paymentStatus === "PAID") {
        throw new Error("SALE_LINE_ALREADY_PAID");
      }
      total += line.lineTotal;
    }

    if (args.paymentMethod === "CASH") {
      if ((args.amountReceived ?? 0) < total) {
        throw new Error("INSUFFICIENT_CASH");
      }
    }

    for (const lineId of args.lineIds) {
      await ctx.db.patch(lineId, {
        paymentStatus: "PAID",
        paymentMethod: args.paymentMethod,
        paymentBatchId: batchId,
        paidAt: now,
        updatedAt: now,
      });
    }

    const changeAmount =
      args.paymentMethod === "CASH"
        ? (args.amountReceived ?? 0) - total
        : undefined;

    await ctx.db.insert("paymentBatches", {
      batchId,
      shiftId: shift._id,
      businessId: shift.businessId,
      paymentMethod: args.paymentMethod,
      total,
      amountReceived:
        args.paymentMethod === "CASH" ? args.amountReceived : undefined,
      changeAmount,
      paidAt: now,
      recordedBy: user._id,
    });

    await updateDailyRollups(ctx, shift.businessId, now);

    return {
      paymentBatchId: batchId,
      total,
      changeAmount: changeAmount ?? 0,
    };
  },
});

export const voidSaleLinePayment = mutation({
  args: {
    sessionToken: v.string(),
    lineId: v.id("saleLines"),
  },
  handler: async (ctx, args) => {
    const { shift } = await requireWritableShiftContext(ctx, args.sessionToken);

    const line = await ctx.db.get(args.lineId);
    if (!line || line.shiftId !== shift._id) {
      throw new Error("SALE_LINE_NOT_FOUND");
    }
    if (line.paymentStatus !== "PAID") {
      throw new Error("SALE_LINE_NOT_PAID");
    }

    const paidAt = line.paidAt ?? Date.now();
    const batchId = line.paymentBatchId;

    await ctx.db.patch(args.lineId, {
      paymentStatus: "UNPAID",
      paymentMethod: undefined,
      paymentBatchId: undefined,
      paidAt: undefined,
      updatedAt: Date.now(),
    });

    if (batchId) {
      const remaining = await ctx.db
        .query("saleLines")
        .withIndex("by_paymentBatchId", (q) => q.eq("paymentBatchId", batchId))
        .collect();
      const stillPaid = remaining.filter((l) => l.paymentStatus === "PAID");
      if (stillPaid.length === 0) {
        const batch = await ctx.db
          .query("paymentBatches")
          .withIndex("by_batchId", (q) => q.eq("batchId", batchId))
          .unique();
        if (batch) await ctx.db.delete(batch._id);
      }
    }

    await updateDailyRollups(ctx, shift.businessId, paidAt);

    return { success: true };
  },
});

export const addCashEntry = mutation({
  args: {
    sessionToken: v.string(),
    type: cashEntryType,
    amount: v.number(),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, shift, businessId } = await requireWritableShiftContext(
      ctx,
      args.sessionToken,
    );

    if (args.amount <= 0) {
      throw new Error("INVALID_AMOUNT");
    }

    const note = args.note.trim();
    if (!note) {
      throw new Error("INVALID_NOTE");
    }

    const entryId = await ctx.db.insert("cashEntries", {
      shiftId: shift._id,
      businessId,
      type: args.type,
      amount: args.amount,
      note,
      recordedBy: user._id,
      createdAt: Date.now(),
    });

    return { entryId };
  },
});

export const addStockReceipt = mutation({
  args: {
    sessionToken: v.string(),
    supplierId: v.id("suppliers"),
    note: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    items: v.array(receiptItem),
  },
  handler: async (ctx, args) => {
    const { user, shift, businessId } = await requireWritableShiftContext(
      ctx,
      args.sessionToken,
    );

    const supplier = await ctx.db.get(args.supplierId);
    if (!supplier || supplier.businessId !== businessId || !supplier.isActive) {
      throw new Error("SUPPLIER_NOT_FOUND");
    }

    const validItems = args.items.filter((item) => item.qty > 0);
    if (validItems.length === 0) {
      throw new Error("NO_ITEMS");
    }

    for (const item of validItems) {
      const product = await ctx.db.get(item.productId);
      if (
        !product ||
        product.businessId !== businessId ||
        product.type !== "RETAIL"
      ) {
        throw new Error("PRODUCT_NOT_FOUND");
      }
      if (item.unitCost != null && item.unitCost < 0) {
        throw new Error("INVALID_UNIT_COST");
      }
      if (product.trackExpiry && !item.expiresAt) {
        throw new Error("EXPIRY_REQUIRED");
      }
    }

    await assertProductsLinkedToSupplier(
      ctx,
      businessId,
      args.supplierId,
      validItems.map((item) => item.productId),
    );

    const resolvedItems = [];
    for (const item of validItems) {
      const { unitCost, isEstimated } = await resolveReceiptUnitCost(
        ctx,
        businessId,
        item.productId,
        args.supplierId,
        item.unitCost,
      );
      resolvedItems.push({ ...item, unitCost, isEstimated });
    }

    const totalAmount = resolvedItems.reduce(
      (sum, item) => sum + item.qty * item.unitCost,
      0,
    );

    const now = Date.now();

    const receiptId = await ctx.db.insert("stockReceipts", {
      shiftId: shift._id,
      businessId,
      supplierId: args.supplierId,
      note: args.note?.trim() || undefined,
      totalAmount,
      dueAt: args.dueAt,
      supplierPaymentStatus: "UNPAID",
      recordedBy: user._id,
      createdAt: now,
    });

    for (const item of resolvedItems) {
      const product = await ctx.db.get(item.productId);
      if (!product) continue;

      await ensureShiftStockSnapshot(ctx, shift._id, item.productId, now);

      await ctx.db.insert("stockReceiptItems", {
        receiptId,
        businessId,
        productId: item.productId,
        supplierId: args.supplierId,
        qty: item.qty,
        qtyRemaining: item.qty,
        unitCost: item.unitCost,
        isEstimated: item.isEstimated,
        expiresAt: item.expiresAt,
        createdAt: now,
      });

      await ctx.db.insert("supplierCostHistory", {
        productId: item.productId,
        businessId,
        supplierId: args.supplierId,
        unitCost: item.unitCost,
        qty: item.qty,
        receiptId,
        effectiveAt: now,
      });

      await ctx.db.insert("stockMovements", {
        shiftId: shift._id,
        businessId,
        productId: item.productId,
        type: "RECEIPT",
        qty: item.qty,
        refId: receiptId,
        recordedBy: user._id,
        createdAt: now,
      });
    }

    return { receiptId };
  },
});

export const updateStockReceiptItemCosts = mutation({
  args: {
    sessionToken: v.string(),
    receiptId: v.id("stockReceipts"),
    items: v.array(
      v.object({
        itemId: v.id("stockReceiptItems"),
        unitCost: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!isAdmin(role) && !isSuperAdmin(role)) {
      throw new Error("FORBIDDEN");
    }
    assertAcl(role, "master_produk");

    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt) {
      throw new Error("RECEIPT_NOT_FOUND");
    }

    await assertBusinessAccess(ctx, user, role, receipt.businessId);

    const receiptItems = await ctx.db
      .query("stockReceiptItems")
      .withIndex("by_receiptId", (q) => q.eq("receiptId", receipt._id))
      .collect();

    const itemById = new Map(receiptItems.map((item) => [item._id, item]));

    for (const update of args.items) {
      if (update.unitCost < 0) {
        throw new Error("INVALID_UNIT_COST");
      }
      const existing = itemById.get(update.itemId);
      if (!existing || existing.receiptId !== receipt._id) {
        throw new Error("RECEIPT_ITEM_NOT_FOUND");
      }

      await ctx.db.patch(update.itemId, {
        unitCost: update.unitCost,
        isEstimated: false,
      });

      const historyEntries = await ctx.db
        .query("supplierCostHistory")
        .withIndex("by_business_product_supplier", (q) =>
          q
            .eq("businessId", receipt.businessId)
            .eq("productId", existing.productId)
            .eq("supplierId", receipt.supplierId),
        )
        .collect();

      const history = historyEntries.find(
        (entry) => entry.receiptId === receipt._id,
      );
      if (history) {
        await ctx.db.patch(history._id, { unitCost: update.unitCost });
      }
    }

    const updatedItems = await ctx.db
      .query("stockReceiptItems")
      .withIndex("by_receiptId", (q) => q.eq("receiptId", receipt._id))
      .collect();

    const totalAmount = updatedItems.reduce(
      (sum, item) => sum + item.qty * item.unitCost,
      0,
    );

    await ctx.db.patch(receipt._id, { totalAmount });

    return { success: true, totalAmount };
  },
});

export const markStockReceiptPaid = mutation({
  args: {
    sessionToken: v.string(),
    receiptId: v.id("stockReceipts"),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!isAdmin(role) && !isSuperAdmin(role)) {
      throw new Error("FORBIDDEN");
    }
    assertAcl(role, "master_produk");

    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt) {
      throw new Error("RECEIPT_NOT_FOUND");
    }

    await assertBusinessAccess(ctx, user, role, receipt.businessId);

    if (receipt.supplierPaymentStatus === "PAID") {
      throw new Error("RECEIPT_ALREADY_PAID");
    }

    const now = Date.now();
    await ctx.db.patch(args.receiptId, {
      supplierPaymentStatus: "PAID",
      paidAt: now,
      markedPaidBy: user._id,
    });

    return { success: true };
  },
});

export const listStockReceipts = query({
  args: {
    sessionToken: v.string(),
    businessId: v.optional(v.id("businesses")),
    paymentStatus: v.optional(supplierPaymentStatus),
    supplierId: v.optional(v.id("suppliers")),
  },
  handler: async (ctx, args) => {
    try {
      const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
      if (!isAdmin(role) && !isSuperAdmin(role)) {
        return [];
      }
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

      let receipts;
      if (args.paymentStatus) {
        receipts = await ctx.db
          .query("stockReceipts")
          .withIndex("by_business_and_paymentStatus", (q) =>
            q
              .eq("businessId", businessId)
              .eq("supplierPaymentStatus", args.paymentStatus!),
          )
          .collect();
      } else {
        receipts = await ctx.db
          .query("stockReceipts")
          .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
          .collect();
      }

      if (args.supplierId) {
        receipts = receipts.filter((r) => r.supplierId === args.supplierId);
      }

      const enriched = [];
      for (const receipt of receipts) {
        const supplier = await ctx.db.get(receipt.supplierId);
        const items = await ctx.db
          .query("stockReceiptItems")
          .withIndex("by_receiptId", (q) => q.eq("receiptId", receipt._id))
          .collect();

        enriched.push({
          _id: receipt._id,
          createdAt: receipt.createdAt,
          supplierId: receipt.supplierId,
          supplierName: supplier?.name ?? "—",
          totalAmount: receipt.totalAmount ?? 0,
          dueAt: receipt.dueAt,
          supplierPaymentStatus: receipt.supplierPaymentStatus ?? "UNPAID",
          paidAt: receipt.paidAt,
          shiftId: receipt.shiftId,
          itemCount: items.length,
          note: receipt.note,
        });
      }

      return enriched.sort((a, b) => {
        const aUnpaid = a.supplierPaymentStatus === "UNPAID" ? 0 : 1;
        const bUnpaid = b.supplierPaymentStatus === "UNPAID" ? 0 : 1;
        if (aUnpaid !== bUnpaid) return aUnpaid - bUnpaid;

        const aDue = a.dueAt ?? Number.MAX_SAFE_INTEGER;
        const bDue = b.dueAt ?? Number.MAX_SAFE_INTEGER;
        if (aDue !== bDue) return aDue - bDue;

        return b.createdAt - a.createdAt;
      });
    } catch (error) {
      console.error("listStockReceipts failed:", error);
      return [];
    }
  },
});

export const getStockReceiptDetail = query({
  args: {
    sessionToken: v.string(),
    receiptId: v.id("stockReceipts"),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!isAdmin(role) && !isSuperAdmin(role)) {
      throw new Error("FORBIDDEN");
    }
    if (!hasAcl(role, "master_produk")) {
      throw new Error("FORBIDDEN");
    }

    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt) {
      throw new Error("RECEIPT_NOT_FOUND");
    }

    await assertBusinessAccess(ctx, user, role, receipt.businessId);

    const supplier = await ctx.db.get(receipt.supplierId);
    const recorder = await ctx.db.get(receipt.recordedBy);
    const items = await ctx.db
      .query("stockReceiptItems")
      .withIndex("by_receiptId", (q) => q.eq("receiptId", receipt._id))
      .collect();

    const enrichedItems = [];
    for (const item of items) {
      const product = await ctx.db.get(item.productId);
      enrichedItems.push({
        itemId: item._id,
        productId: item.productId,
        productName: product?.name ?? "—",
        productUnit: product?.unit ?? "",
        qty: item.qty,
        unitCost: item.unitCost,
        isEstimated: item.isEstimated ?? false,
        lineTotal: item.qty * item.unitCost,
        expiresAt: item.expiresAt,
      });
    }

    return {
      _id: receipt._id,
      createdAt: receipt.createdAt,
      supplierId: receipt.supplierId,
      supplierName: supplier?.name ?? "—",
      totalAmount: receipt.totalAmount ?? 0,
      dueAt: receipt.dueAt,
      supplierPaymentStatus: receipt.supplierPaymentStatus ?? "UNPAID",
      paidAt: receipt.paidAt,
      shiftId: receipt.shiftId,
      note: receipt.note,
      recordedByName: recorder?.name ?? "—",
      items: enrichedItems,
    };
  },
});

export const addStockWriteOff = mutation({
  args: {
    sessionToken: v.string(),
    productId: v.id("products"),
    qty: v.number(),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, shift, businessId } = await requireWritableShiftContext(
      ctx,
      args.sessionToken,
    );

    const product = await ctx.db.get(args.productId);
    if (
      !product ||
      product.businessId !== businessId ||
      product.type !== "RETAIL"
    ) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    if (args.qty <= 0) {
      throw new Error("INVALID_QTY");
    }

    const note = args.note.trim();
    if (!note) {
      throw new Error("INVALID_NOTE");
    }

    const now = Date.now();
    await ensureShiftStockSnapshot(ctx, shift._id, args.productId, now);

    const movementId = await ctx.db.insert("stockMovements", {
      shiftId: shift._id,
      businessId,
      productId: args.productId,
      type: "WRITEOFF",
      qty: args.qty,
      note,
      recordedBy: user._id,
      createdAt: now,
    });

    return { movementId };
  },
});

export const closeShift = mutation({
  args: {
    sessionToken: v.string(),
    closingCash: v.number(),
    closingQris: v.number(),
    closingStock: v.array(closingStockItem),
  },
  handler: async (ctx, args) => {
    const context = await requireOpenShiftContext(ctx, args.sessionToken);
    const { user, shift, businessId, role } = context;

    await assertCanManageShift(ctx, user, role, businessId);

    if (args.closingCash < 0 || args.closingQris < 0) {
      throw new Error("INVALID_CASH");
    }

    const now = Date.now();
    const result = await finalizeShiftClose(
      ctx,
      shift,
      user._id,
      args.closingCash,
      args.closingQris,
      args.closingStock,
      now,
    );

    return {
      shiftId: shift._id,
      ...result,
    };
  },
});

export const getSuggestedOpeningStock = query({
  args: {
    sessionToken: v.string(),
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    await assertBusinessAccess(ctx, user, role, args.businessId);
    return loadSuggestedOpeningStock(ctx, args.businessId);
  },
});

export const getShiftClosePreview = query({
  args: {
    sessionToken: v.string(),
    reportedCash: v.number(),
    verifiedQris: v.optional(v.number()),
    closingStock: v.array(closingStockItem),
  },
  handler: async (ctx, args) => {
    const { shift } = await requireOpenShiftContext(ctx, args.sessionToken);
    return computeClosePreview(
      ctx,
      shift,
      args.reportedCash,
      args.verifiedQris ?? 0,
      args.closingStock,
    );
  },
});

export const submitShiftCloseRequest = mutation({
  args: {
    sessionToken: v.string(),
    reportedCash: v.number(),
    closingStock: v.array(closingStockItem),
    staffNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, shift, businessId } = await requireWritableShiftContext(
      ctx,
      args.sessionToken,
    );

    if (args.reportedCash < 0) {
      throw new Error("INVALID_CASH");
    }

    const existing = await ctx.db
      .query("shiftCloseRequests")
      .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
      .filter((q) => q.eq(q.field("status"), "PENDING"))
      .first();

    if (existing) {
      throw new Error("CLOSE_REQUEST_ALREADY_PENDING");
    }

    const now = Date.now();
    const requestId = await ctx.db.insert("shiftCloseRequests", {
      shiftId: shift._id,
      businessId,
      status: "PENDING",
      submittedBy: user._id,
      submittedAt: now,
      reportedCash: args.reportedCash,
      closingStock: args.closingStock,
      staffNote: args.staffNote?.trim() || undefined,
    });

    await ctx.db.patch(shift._id, {
      status: "CLOSE_PENDING",
      updatedAt: now,
    });

    return { requestId };
  },
});

export const approveShiftCloseRequest = mutation({
  args: {
    sessionToken: v.string(),
    requestId: v.id("shiftCloseRequests"),
    verifiedQris: v.number(),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "PENDING") {
      throw new Error("CLOSE_REQUEST_NOT_FOUND");
    }

    await assertCanManageShift(ctx, user, role, request.businessId);

    const shift = await ctx.db.get(request.shiftId);
    if (!shift || shift.status !== "CLOSE_PENDING") {
      throw new Error("SHIFT_NOT_FOUND");
    }

    if (args.verifiedQris < 0) {
      throw new Error("INVALID_CASH");
    }

    const now = Date.now();
    const result = await finalizeShiftClose(
      ctx,
      shift,
      user._id,
      request.reportedCash,
      args.verifiedQris,
      request.closingStock,
      now,
    );

    await ctx.db.patch(request._id, {
      status: "APPROVED",
      verifiedQris: args.verifiedQris,
      reviewedBy: user._id,
      reviewedAt: now,
      adminNote: args.adminNote?.trim() || undefined,
    });

    return {
      shiftId: shift._id,
      ...result,
    };
  },
});

export const rejectShiftCloseRequest = mutation({
  args: {
    sessionToken: v.string(),
    requestId: v.id("shiftCloseRequests"),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "PENDING") {
      throw new Error("CLOSE_REQUEST_NOT_FOUND");
    }

    await assertCanManageShift(ctx, user, role, request.businessId);

    const shift = await ctx.db.get(request.shiftId);
    if (!shift || shift.status !== "CLOSE_PENDING") {
      throw new Error("SHIFT_NOT_FOUND");
    }

    const now = Date.now();
    await ctx.db.patch(request._id, {
      status: "REJECTED",
      reviewedBy: user._id,
      reviewedAt: now,
      adminNote: args.adminNote?.trim() || undefined,
    });

    await ctx.db.patch(shift._id, {
      status: "OPEN",
      updatedAt: now,
    });

    return { success: true };
  },
});

export const listPendingCloseRequests = query({
  args: {
    sessionToken: v.string(),
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    await assertCanManageShift(ctx, user, role, args.businessId);

    const requests = await ctx.db
      .query("shiftCloseRequests")
      .withIndex("by_business_and_status", (q) =>
        q.eq("businessId", args.businessId).eq("status", "PENDING"),
      )
      .collect();

    const enriched = [];
    for (const request of requests.sort(
      (a, b) => a.submittedAt - b.submittedAt,
    )) {
      const shift = await ctx.db.get(request.shiftId);
      const submitter = await ctx.db.get(request.submittedBy);
      const preview = shift
        ? await computeClosePreview(
            ctx,
            shift,
            request.reportedCash,
            0,
            request.closingStock,
          )
        : null;

      enriched.push({
        ...request,
        submitterName: submitter?.name ?? "—",
        preview,
      });
    }

    return enriched;
  },
});
