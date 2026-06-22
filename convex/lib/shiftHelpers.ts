import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getRoleById } from "./authHelpers";
import { getFallbackUnitCost } from "./inventoryCostHelpers";

export function calculateLineTotal(
  product: Doc<"products">,
  qty: number,
  rentalHours?: number,
): { unitPrice: number; lineTotal: number } {
  if (product.type === "RENTAL") {
    const hours = rentalHours ?? 0;
    const unitPrice = product.rentalPricePerHour ?? 0;
    return { unitPrice, lineTotal: unitPrice * qty * hours };
  }

  return { unitPrice: product.sellPrice, lineTotal: product.sellPrice * qty };
}

export async function getOpenShiftForBusiness(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
) {
  const open = await ctx.db
    .query("shifts")
    .withIndex("by_business_and_status", (q) =>
      q.eq("businessId", businessId).eq("status", "OPEN"),
    )
    .first();

  if (open) return open;

  return ctx.db
    .query("shifts")
    .withIndex("by_business_and_status", (q) =>
      q.eq("businessId", businessId).eq("status", "CLOSE_PENDING"),
    )
    .first();
}

export async function getWritableOpenShiftForBusiness(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
) {
  return ctx.db
    .query("shifts")
    .withIndex("by_business_and_status", (q) =>
      q.eq("businessId", businessId).eq("status", "OPEN"),
    )
    .first();
}

export async function sumStockMovementsByProduct(
  ctx: QueryCtx | MutationCtx,
  shiftId: Id<"shifts">,
  productId: Id<"products">,
  type: Doc<"stockMovements">["type"],
) {
  const movements = await ctx.db
    .query("stockMovements")
    .withIndex("by_shift_and_product", (q) =>
      q.eq("shiftId", shiftId).eq("productId", productId),
    )
    .collect();

  return movements
    .filter((movement) => movement.type === type)
    .reduce((sum, movement) => sum + movement.qty, 0);
}

/** Creates shiftStockSnapshot with openingQty=0 when product joins mid-shift. */
export async function ensureShiftStockSnapshot(
  ctx: MutationCtx,
  shiftId: Id<"shifts">,
  productId: Id<"products">,
  now: number,
) {
  const existing = await ctx.db
    .query("shiftStockSnapshots")
    .withIndex("by_shift_and_product", (q) =>
      q.eq("shiftId", shiftId).eq("productId", productId),
    )
    .unique();

  if (existing) return;

  const product = await ctx.db.get(productId);
  if (!product || product.type !== "RETAIL") return;

  await ctx.db.insert("shiftStockSnapshots", {
    shiftId,
    productId,
    openingQty: 0,
    createdAt: now,
    updatedAt: now,
  });
}

export async function getShiftStockReconciliation(
  ctx: QueryCtx | MutationCtx,
  shiftId: Id<"shifts">,
) {
  const snapshots = await ctx.db
    .query("shiftStockSnapshots")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();

  const saleLines = await ctx.db
    .query("saleLines")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();

  const paidQtyByProduct = new Map<string, number>();
  for (const line of saleLines) {
    if (line.paymentStatus !== "PAID") continue;
    const product = await ctx.db.get(line.productId);
    if (product?.type !== "RETAIL") continue;
    const key = line.productId;
    paidQtyByProduct.set(key, (paidQtyByProduct.get(key) ?? 0) + line.qty);
  }

  const results = [];
  for (const snapshot of snapshots) {
    const product = await ctx.db.get(snapshot.productId);
    if (!product) continue;

    const received = await sumStockMovementsByProduct(
      ctx,
      shiftId,
      snapshot.productId,
      "RECEIPT",
    );
    const writeOff = await sumStockMovementsByProduct(
      ctx,
      shiftId,
      snapshot.productId,
      "WRITEOFF",
    );
    const soldQtyFromLines = paidQtyByProduct.get(snapshot.productId) ?? 0;

    // Physical reconciliation only after closing stock is counted (not while shift is open).
    const hasClosingCount = snapshot.closingQty !== undefined;
    const closingQty = snapshot.closingQty ?? 0;
    let soldQtyFromStock = 0;
    let overInputQty = 0;
    let missInputQty = 0;

    if (hasClosingCount) {
      soldQtyFromStock = Math.max(
        0,
        snapshot.openingQty + received - closingQty - writeOff,
      );
      overInputQty = Math.max(0, soldQtyFromLines - soldQtyFromStock);
      missInputQty = Math.max(0, soldQtyFromStock - soldQtyFromLines);
    }

    results.push({
      productId: snapshot.productId,
      productName: product.name,
      openingQty: snapshot.openingQty,
      receivedQty: received,
      writeOffQty: writeOff,
      closingQty,
      soldQtyFromStock,
      soldQtyFromLines,
      qtyVariance: soldQtyFromStock - soldQtyFromLines,
      overInputQty,
      missInputQty,
    });
  }

  return results;
}

export async function getShiftSalesByPriceTier(
  ctx: QueryCtx | MutationCtx,
  shiftId: Id<"shifts">,
  businessId: Id<"businesses">,
) {
  const lines = await ctx.db
    .query("saleLines")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();

  const tierMap = new Map<
    string,
    {
      productId: Id<"products">;
      productName: string;
      unitPrice: number;
      qty: number;
      revenue: number;
      cogs: number;
      productType: "RETAIL" | "RENTAL";
      rentalHoursTotal: number;
    }
  >();

  for (const line of lines) {
    if (line.paymentStatus !== "PAID") continue;
    const product = await ctx.db.get(line.productId);
    const key = `${line.productId}:${line.unitPrice}`;
    const productType = product?.type ?? "RETAIL";
    const rentalHours = line.rentalHours ?? 0;
    let lineCogs = 0;
    if (productType === "RETAIL") {
      const unitCost = await getFallbackUnitCost(
        ctx,
        businessId,
        line.productId,
      );
      lineCogs = line.qty * unitCost;
    }
    const existing = tierMap.get(key);
    if (existing) {
      existing.qty += line.qty;
      existing.revenue += line.lineTotal;
      existing.cogs += lineCogs;
      if (productType === "RENTAL") {
        existing.rentalHoursTotal += line.qty * rentalHours;
      }
    } else {
      tierMap.set(key, {
        productId: line.productId,
        productName: product?.name ?? "—",
        unitPrice: line.unitPrice,
        qty: line.qty,
        revenue: line.lineTotal,
        cogs: lineCogs,
        productType,
        rentalHoursTotal: productType === "RENTAL" ? line.qty * rentalHours : 0,
      });
    }
  }

  return Array.from(tierMap.values())
    .map((tier) => ({
      ...tier,
      unitCost: tier.qty > 0 ? tier.cogs / tier.qty : 0,
      grossProfit: tier.revenue - tier.cogs,
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName));
}

export async function computeImpliedRevenue(
  ctx: QueryCtx | MutationCtx,
  shiftId: Id<"shifts">,
) {
  const recon = await getShiftStockReconciliation(ctx, shiftId);
  let impliedRevenue = 0;

  for (const row of recon) {
    if (row.missInputQty <= 0) continue;
    const product = await ctx.db.get(row.productId);
    if (!product || product.type !== "RETAIL") continue;
    impliedRevenue += row.missInputQty * product.sellPrice;
  }

  return impliedRevenue;
}

export async function getShiftSalesStats(
  ctx: QueryCtx | MutationCtx,
  shiftId: Id<"shifts">,
  shiftCogs?: number,
) {
  const shift = await ctx.db.get(shiftId);
  if (!shift) {
    throw new Error("SHIFT_NOT_FOUND");
  }

  const lines = await ctx.db
    .query("saleLines")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();

  let paidRevenue = 0;
  let unpaidRevenue = 0;
  const productMap = new Map<
    string,
    {
      productId: Id<"products">;
      productName: string;
      qty: number;
      revenue: number;
      cogs: number;
    }
  >();

  for (const line of lines) {
    const product = await ctx.db.get(line.productId);
    const productType = product?.type ?? "RETAIL";
    if (line.paymentStatus === "PAID") {
      paidRevenue += line.lineTotal;
      let lineCogs = 0;
      if (productType === "RETAIL") {
        const unitCost = await getFallbackUnitCost(
          ctx,
          shift.businessId,
          line.productId,
        );
        lineCogs = line.qty * unitCost;
      }
      const key = line.productId;
      const existing = productMap.get(key);
      if (existing) {
        existing.qty += line.qty;
        existing.revenue += line.lineTotal;
        existing.cogs += lineCogs;
      } else {
        productMap.set(key, {
          productId: line.productId,
          productName: product?.name ?? "—",
          qty: line.qty,
          revenue: line.lineTotal,
          cogs: lineCogs,
        });
      }
    } else {
      unpaidRevenue += line.lineTotal;
    }
  }

  let totalCogs = shiftCogs;
  if (totalCogs === undefined) {
    const lots = await ctx.db
      .query("shiftCogsLots")
      .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
      .collect();
    totalCogs = lots.reduce((sum, lot) => sum + lot.qty * lot.unitCost, 0);
  }

  const estimatedTotalCogs = Array.from(productMap.values()).reduce(
    (sum, product) => sum + product.cogs,
    0,
  );
  const estimatedGrossProfit = paidRevenue - estimatedTotalCogs;

  const topProducts = Array.from(productMap.values())
    .map((product) => ({
      ...product,
      unitCost: product.qty > 0 ? product.cogs / product.qty : 0,
      grossProfit: product.revenue - product.cogs,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return {
    paidRevenue,
    unpaidRevenue,
    totalCogs,
    estimatedTotalCogs,
    estimatedGrossProfit,
    grossProfit: paidRevenue - totalCogs,
    topProducts,
    salesByPriceTier: await getShiftSalesByPriceTier(
      ctx,
      shiftId,
      shift.businessId,
    ),
  };
}

/** @deprecated Use getShiftStockReconciliation + getShiftSalesStats */
export async function getShiftStockSummary(
  ctx: QueryCtx | MutationCtx,
  shiftId: Id<"shifts">,
) {
  const shift = await ctx.db.get(shiftId);
  if (!shift) {
    throw new Error("SHIFT_NOT_FOUND");
  }
  const recon = await getShiftStockReconciliation(ctx, shiftId);
  const tiers = await getShiftSalesByPriceTier(ctx, shiftId, shift.businessId);

  const revenueByProduct = new Map<string, number>();
  for (const tier of tiers) {
    revenueByProduct.set(
      tier.productId,
      (revenueByProduct.get(tier.productId) ?? 0) + tier.revenue,
    );
  }

  return recon.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    openingQty: item.openingQty,
    receivedQty: item.receivedQty,
    writeOffQty: item.writeOffQty,
    closingQty: item.closingQty,
    soldQty: item.soldQtyFromLines,
    revenue: revenueByProduct.get(item.productId) ?? 0,
  }));
}

export async function getShiftCashSummary(
  ctx: QueryCtx | MutationCtx,
  shift: Doc<"shifts">,
) {
  const saleLines = await ctx.db
    .query("saleLines")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
    .collect();

  const paidLines = saleLines.filter((line) => line.paymentStatus === "PAID");
  const totalSales = paidLines.reduce((sum, line) => sum + line.lineTotal, 0);
  const recordedCashSales = paidLines
    .filter((line) => line.paymentMethod === "CASH")
    .reduce((sum, line) => sum + line.lineTotal, 0);
  const recordedQrisSales = paidLines
    .filter((line) => line.paymentMethod === "QRIS")
    .reduce((sum, line) => sum + line.lineTotal, 0);

  const cashEntries = await ctx.db
    .query("cashEntries")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shift._id))
    .collect();

  const expenses = cashEntries
    .filter((entry) => entry.type === "EXPENSE")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const deposits = cashEntries
    .filter((entry) => entry.type === "DEPOSIT")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const cashIncome = cashEntries
    .filter((entry) => entry.type === "INCOME")
    .reduce((sum, entry) => sum + entry.amount, 0);

  const verifiedQris = shift.closingQris ?? 0;
  const reportedCash = shift.closingCash ?? 0;
  const expectedCashInDrawer =
    shift.openingCash +
    totalSales +
    cashIncome -
    verifiedQris -
    expenses -
    deposits;
  const cashVariance = reportedCash - expectedCashInDrawer;
  const totalExpected =
    shift.openingCash + totalSales + cashIncome - expenses - deposits;
  const totalActual = reportedCash + verifiedQris;
  const totalVariance = totalActual - totalExpected;

  return {
    openingCash: shift.openingCash,
    totalSales,
    recordedCashSales,
    recordedQrisSales,
    cashSales: recordedCashSales,
    qrisSales: recordedQrisSales,
    expenses,
    deposits,
    cashIncome,
    verifiedQris,
    reportedCash,
    expectedCashInDrawer,
    cashVariance,
    totalExpected,
    totalActual,
    totalVariance,
    expectedCash: expectedCashInDrawer,
    expectedTotal: totalExpected,
    actualCash: reportedCash,
    actualQris: verifiedQris,
    actualTotal: totalActual,
    variance: totalVariance,
  };
}

export function generatePaymentBatchId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function formatDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type ShiftAssignee = {
  _id: Id<"users">;
  name: string;
  email: string;
  picture?: string;
  roleName: string;
  businessRole: "STAFF" | "OWNER";
};

async function toShiftAssignee(
  ctx: QueryCtx | MutationCtx,
  member: Doc<"users">,
  businessRole: "STAFF" | "OWNER",
): Promise<ShiftAssignee> {
  const role = await getRoleById(ctx, member.roleId);
  return {
    _id: member._id,
    name: member.name,
    email: member.email,
    picture: member.picture,
    roleName: role?.name ?? "STAFF",
    businessRole,
  };
}

export async function resolveShiftAssignees(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
): Promise<ShiftAssignee[]> {
  const business = await ctx.db.get(businessId);
  if (!business) return [];

  const memberships = await ctx.db
    .query("businessMembers")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();

  const staffAssignees: ShiftAssignee[] = [];
  for (const membership of memberships) {
    if (membership.role !== "STAFF") continue;
    const member = await ctx.db.get(membership.userId);
    if (!member || member.status !== "APPROVED") continue;
    staffAssignees.push(await toShiftAssignee(ctx, member, "STAFF"));
  }

  if (staffAssignees.length > 0) {
    return staffAssignees.sort((a, b) => a.name.localeCompare(b.name));
  }

  const ownerIds = new Set<Id<"users">>();
  ownerIds.add(business.ownerId);
  for (const membership of memberships) {
    if (membership.role === "OWNER") {
      ownerIds.add(membership.userId);
    }
  }

  const ownerAssignees: ShiftAssignee[] = [];
  for (const ownerId of ownerIds) {
    const owner = await ctx.db.get(ownerId);
    if (!owner || owner.status !== "APPROVED") continue;
    ownerAssignees.push(await toShiftAssignee(ctx, owner, "OWNER"));
  }

  return ownerAssignees.sort((a, b) => a.name.localeCompare(b.name));
}

export async function isValidShiftAssignee(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
  userId: Id<"users">,
): Promise<boolean> {
  const assignees = await resolveShiftAssignees(ctx, businessId);
  return assignees.some((assignee) => assignee._id === userId);
}
