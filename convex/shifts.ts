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
  allocateCostForSaleLine,
  reverseCostLotsForSaleLine,
} from "./lib/inventoryCostHelpers";
import { getRoleById } from "./lib/authHelpers";
import { parseGroupLabel } from "./lib/groupLabelHelpers";
import {
  assertAcl,
  getAuthenticatedUser,
  hasAcl,
  isAdmin,
  isSuperAdmin,
} from "./lib/rbac";
import {
  archiveShiftDetails,
  buildAndSaveShiftSummary,
  updateDailyRollups,
} from "./lib/shiftReportHelpers";
import {
  calculateLineTotal,
  generatePaymentBatchId,
  getOpenShiftForBusiness,
  getShiftCashSummary,
  getShiftSalesByPriceTier,
  getShiftSalesStats,
  getShiftStockSummary,
  isValidShiftAssignee,
  resolveShiftAssignees,
  sumStockMovementsByProduct,
} from "./lib/shiftHelpers";

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
  unitCost: v.number(),
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
        canManageShift: canManage,
        assignedStaff,
      };
    } catch (error) {
      console.error("getKasirContext failed:", error);
      return {
        businesses: [],
        activeBusinessId: null,
        openShift: null,
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
    const { shift } = await requireOpenShiftContext(ctx, args.sessionToken);

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
    const { shift } = await requireOpenShiftContext(ctx, args.sessionToken);
    return getShiftCashSummary(ctx, shift);
  },
});

export const getShiftLiveStats = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const { shift } = await requireOpenShiftContext(ctx, args.sessionToken);
    return getShiftSalesStats(ctx, shift._id);
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
      return {
        shift,
        summary: saved,
        cashSummary,
        totalRevenue: saved.totalRevenue,
      };
    }

    const salesStats = await getShiftSalesStats(ctx, shift._id);
    const stockSummary = await getShiftStockSummary(ctx, shift._id);
    const cashSummary = await getShiftCashSummary(ctx, shift);

    return {
      shift,
      stockSummary,
      salesByPriceTier: salesStats.salesByPriceTier,
      cashSummary,
      totalRevenue: salesStats.paidRevenue,
      grossProfit: salesStats.grossProfit,
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

    return summaries
      .sort((a, b) => b.closedAt - a.closedAt)
      .slice(0, args.limit ?? 20);
  },
});

export const listSaleLines = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const { shift, businessId } = await requireOpenShiftContext(
      ctx,
      args.sessionToken,
    );

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
      enrichedLines.push({
        productName: product?.name ?? "—",
        qty: line.qty,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
        paymentStatus: line.paymentStatus,
        paymentMethod: line.paymentMethod,
        cogsTotal: line.cogsTotal,
        paidAt: line.paidAt,
      });
    }

    return { shift, summary, lines: enrichedLines };
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
        await ctx.db.insert("stockMovements", {
          shiftId,
          businessId: context.activeBusinessId,
          productId: item.productId,
          type: "OPENING",
          qty: item.qty,
          recordedBy: context.user._id,
          createdAt: now,
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
    const { user, shift, businessId } = await requireOpenShiftContext(
      ctx,
      args.sessionToken,
    );

    const product = await ctx.db.get(args.productId);
    if (!product || product.businessId !== businessId || !product.isActive) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    if (product.type === "RENTAL") {
      if ((args.rentalHours ?? 0) <= 0) {
        throw new Error("INVALID_RENTAL_HOURS");
      }
      if (!args.rentalDescription?.trim()) {
        throw new Error("RENTAL_DESCRIPTION_REQUIRED");
      }
    } else if (args.qty <= 0) {
      throw new Error("INVALID_QTY");
    }

    const { unitPrice, lineTotal } = calculateLineTotal(
      product,
      args.qty,
      args.rentalHours,
    );

    const now = Date.now();
    const lineId = await ctx.db.insert("saleLines", {
      shiftId: shift._id,
      businessId,
      productId: product._id,
      groupLabel: parseGroupLabel(args.groupLabel),
      customerNote: args.customerNote?.trim() || undefined,
      rentalDescription: args.rentalDescription?.trim() || undefined,
      qty: product.type === "RENTAL" ? 1 : args.qty,
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
    const { shift, businessId } = await requireOpenShiftContext(
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
      if ((rentalHours ?? 0) <= 0) throw new Error("INVALID_RENTAL_HOURS");
      if (!rentalDescription?.trim()) {
        throw new Error("RENTAL_DESCRIPTION_REQUIRED");
      }
    } else if (qty <= 0) {
      throw new Error("INVALID_QTY");
    }

    const { unitPrice, lineTotal } = calculateLineTotal(
      product,
      product.type === "RENTAL" ? 1 : qty,
      rentalHours,
    );

    await ctx.db.patch(args.lineId, {
      productId,
      qty: product.type === "RENTAL" ? 1 : qty,
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
    const { shift } = await requireOpenShiftContext(ctx, args.sessionToken);

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
    const { user, shift } = await requireOpenShiftContext(
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
      const line = (await ctx.db.get(lineId))!;

      let cogsTotal: number | undefined;
      const product = await ctx.db.get(line.productId);
      if (product?.type === "RETAIL") {
        cogsTotal = await allocateCostForSaleLine(
          ctx,
          shift.businessId,
          line.productId,
          line.qty,
          lineId,
        );

        await ctx.db.insert("stockMovements", {
          shiftId: shift._id,
          businessId: shift.businessId,
          productId: line.productId,
          type: "SALE",
          qty: line.qty,
          refId: lineId,
          recordedBy: user._id,
          createdAt: now,
        });
      }

      await ctx.db.patch(lineId, {
        paymentStatus: "PAID",
        paymentMethod: args.paymentMethod,
        paymentBatchId: batchId,
        paidAt: now,
        cogsTotal,
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
    const { shift } = await requireOpenShiftContext(ctx, args.sessionToken);

    const line = await ctx.db.get(args.lineId);
    if (!line || line.shiftId !== shift._id) {
      throw new Error("SALE_LINE_NOT_FOUND");
    }
    if (line.paymentStatus !== "PAID") {
      throw new Error("SALE_LINE_NOT_PAID");
    }

    const paidAt = line.paidAt ?? Date.now();
    const batchId = line.paymentBatchId;

    const movements = await ctx.db
      .query("stockMovements")
      .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
      .collect();

    for (const movement of movements) {
      if (movement.refId === args.lineId && movement.type === "SALE") {
        await ctx.db.delete(movement._id);
      }
    }

    await reverseCostLotsForSaleLine(ctx, args.lineId);

    await ctx.db.patch(args.lineId, {
      paymentStatus: "UNPAID",
      paymentMethod: undefined,
      paymentBatchId: undefined,
      paidAt: undefined,
      cogsTotal: undefined,
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
    const { user, shift, businessId } = await requireOpenShiftContext(
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
    const { user, shift, businessId } = await requireOpenShiftContext(
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
      if (item.unitCost < 0) {
        throw new Error("INVALID_UNIT_COST");
      }
      if (product.trackExpiry && !item.expiresAt) {
        throw new Error("EXPIRY_REQUIRED");
      }
    }

    const totalAmount = validItems.reduce(
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

    for (const item of validItems) {
      const product = await ctx.db.get(item.productId);
      if (!product) continue;

      await ctx.db.insert("stockReceiptItems", {
        receiptId,
        businessId,
        productId: item.productId,
        supplierId: args.supplierId,
        qty: item.qty,
        qtyRemaining: item.qty,
        unitCost: item.unitCost,
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

export const addStockWriteOff = mutation({
  args: {
    sessionToken: v.string(),
    productId: v.id("products"),
    qty: v.number(),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, shift, businessId } = await requireOpenShiftContext(
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

    const movementId = await ctx.db.insert("stockMovements", {
      shiftId: shift._id,
      businessId,
      productId: args.productId,
      type: "WRITEOFF",
      qty: args.qty,
      note,
      recordedBy: user._id,
      createdAt: Date.now(),
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

    for (const item of args.closingStock) {
      if (item.qty < 0) continue;

      const snapshot = await ctx.db
        .query("shiftStockSnapshots")
        .withIndex("by_shift_and_product", (q) =>
          q.eq("shiftId", shift._id).eq("productId", item.productId),
        )
        .unique();

      if (!snapshot) continue;

      await ctx.db.patch(snapshot._id, {
        closingQty: item.qty,
        updatedAt: now,
      });

      await ctx.db.insert("stockMovements", {
        shiftId: shift._id,
        businessId,
        productId: item.productId,
        type: "CLOSE_COUNT",
        qty: item.qty,
        recordedBy: user._id,
        createdAt: now,
      });
    }

    await ctx.db.patch(shift._id, {
      status: "CLOSED",
      closedBy: user._id,
      closedAt: now,
      closingCash: args.closingCash,
      closingQris: args.closingQris,
      updatedAt: now,
    });

    const closedShift = {
      ...shift,
      status: "CLOSED" as const,
      closedBy: user._id,
      closedAt: now,
      closingCash: args.closingCash,
      closingQris: args.closingQris,
    };

    const summary = await buildAndSaveShiftSummary(ctx, closedShift, now);
    const cashSummary = await getShiftCashSummary(ctx, closedShift);
    const salesByPriceTier = await getShiftSalesByPriceTier(ctx, shift._id);

    return {
      shiftId: shift._id,
      summary,
      cashSummary,
      salesByPriceTier,
      totalRevenue: summary.totalRevenue,
    };
  },
});

export const archiveShift = mutation({
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

    await assertCanManageShift(ctx, user, role, activeBusinessId);

    const shift = await ctx.db.get(args.shiftId);
    if (!shift || shift.businessId !== activeBusinessId) {
      throw new Error("SHIFT_NOT_FOUND");
    }

    await archiveShiftDetails(ctx, shift._id);
    return { success: true };
  },
});
