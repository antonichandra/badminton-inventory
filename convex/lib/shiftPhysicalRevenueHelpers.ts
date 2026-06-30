import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getFallbackUnitCost } from "./inventoryCostHelpers";
import { resolveRetailSellPriceAt } from "./productPriceHistoryHelpers";
import { resolveProductCategory } from "./productCategoryHelpers";

export interface PhysicalStockSoldRow {
  productId: Id<"products">;
  soldQtyFromStock?: number;
  soldFromStock?: number;
}

export type PhysicalPriceTier = {
  productId: Id<"products">;
  productName: string;
  categoryId?: Id<"productCategories">;
  categoryName: string;
  unitPrice: number;
  qty: number;
  revenue: number;
  cogs: number;
  productType: "RETAIL" | "RENTAL";
  rentalHoursTotal: number;
  unitCost: number;
  grossProfit: number;
};

async function loadPaidRetailLinesByProduct(
  ctx: QueryCtx | MutationCtx,
  shiftId: Id<"shifts">,
) {
  const saleLines = await ctx.db
    .query("saleLines")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();

  const byProduct = new Map<string, Doc<"saleLines">[]>();
  for (const line of saleLines) {
    if (line.paymentStatus !== "PAID") continue;
    const product = await ctx.db.get(line.productId);
    if (!product || product.type !== "RETAIL") continue;
    const lines = byProduct.get(line.productId) ?? [];
    lines.push(line);
    byProduct.set(line.productId, lines);
  }

  for (const lines of byProduct.values()) {
    lines.sort((a, b) => a.createdAt - b.createdAt);
  }

  return byProduct;
}

function upsertRetailTier(
  tierMap: Map<string, PhysicalPriceTier>,
  args: {
    productId: Id<"products">;
    productName: string;
    categoryId?: Id<"productCategories">;
    categoryName: string;
    unitPrice: number;
    qty: number;
    unitCost: number;
  },
) {
  const key = `${args.productId}:${args.unitPrice}`;
  const cogs = args.qty * args.unitCost;
  const revenue = args.qty * args.unitPrice;
  const existing = tierMap.get(key);
  if (existing) {
    existing.qty += args.qty;
    existing.revenue += revenue;
    existing.cogs += cogs;
    existing.grossProfit = existing.revenue - existing.cogs;
    existing.unitCost = existing.qty > 0 ? existing.cogs / existing.qty : 0;
    return;
  }

  tierMap.set(key, {
    productId: args.productId,
    productName: args.productName,
    categoryId: args.categoryId,
    categoryName: args.categoryName,
    unitPrice: args.unitPrice,
    qty: args.qty,
    revenue,
    cogs,
    productType: "RETAIL",
    rentalHoursTotal: 0,
    unitCost: args.unitCost,
    grossProfit: revenue - cogs,
  });
}

/** Retail tiers from physical stock, priced by recorded kasir lines then historical price. */
export async function allocatePhysicalRetailTiers(
  ctx: QueryCtx | MutationCtx,
  shiftId: Id<"shifts">,
  businessId: Id<"businesses">,
  stockRows: PhysicalStockSoldRow[],
  asOf: number,
  includeCost: boolean,
): Promise<PhysicalPriceTier[]> {
  const paidRetailByProduct = await loadPaidRetailLinesByProduct(ctx, shiftId);
  const tierMap = new Map<string, PhysicalPriceTier>();

  for (const row of stockRows) {
    const sold = Math.max(0, row.soldQtyFromStock ?? row.soldFromStock ?? 0);
    if (sold <= 0) continue;

    const product = await ctx.db.get(row.productId);
    if (!product || product.type !== "RETAIL") continue;

    const unitCost = includeCost
      ? await getFallbackUnitCost(ctx, businessId, row.productId)
      : 0;
    const category = await resolveProductCategory(ctx, product);

    let remaining = sold;
    const productLines = paidRetailByProduct.get(row.productId) ?? [];
    for (const line of productLines) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, line.qty);
      if (take <= 0) continue;
      upsertRetailTier(tierMap, {
        productId: row.productId,
        productName: product.name,
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        unitPrice: line.unitPrice,
        qty: take,
        unitCost,
      });
      remaining -= take;
    }

    if (remaining > 0) {
      const unitPrice = await resolveRetailSellPriceAt(
        ctx,
        row.productId,
        businessId,
        asOf,
      );
      upsertRetailTier(tierMap, {
        productId: row.productId,
        productName: product.name,
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        unitPrice,
        qty: remaining,
        unitCost,
      });
    }
  }

  return Array.from(tierMap.values());
}

async function loadRentalPriceTiers(
  ctx: QueryCtx | MutationCtx,
  shiftId: Id<"shifts">,
): Promise<PhysicalPriceTier[]> {
  const saleLines = await ctx.db
    .query("saleLines")
    .withIndex("by_shiftId", (q) => q.eq("shiftId", shiftId))
    .collect();

  const rentalMap = new Map<
    string,
    {
      productId: Id<"products">;
      productName: string;
      categoryId?: Id<"productCategories">;
      categoryName: string;
      unitPrice: number;
      qty: number;
      revenue: number;
      rentalHoursTotal: number;
    }
  >();

  for (const line of saleLines) {
    if (line.paymentStatus !== "PAID") continue;
    const product = await ctx.db.get(line.productId);
    if (!product || product.type !== "RENTAL") continue;

    const key = `${line.productId}:${line.unitPrice}`;
    const rentalHours = line.rentalHours ?? 0;
    const existing = rentalMap.get(key);
    if (existing) {
      existing.qty += line.qty;
      existing.revenue += line.lineTotal;
      existing.rentalHoursTotal += line.qty * rentalHours;
    } else {
      const category = await resolveProductCategory(ctx, product);
      rentalMap.set(key, {
        productId: line.productId,
        productName: product.name,
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        unitPrice: line.unitPrice,
        qty: line.qty,
        revenue: line.lineTotal,
        rentalHoursTotal: line.qty * rentalHours,
      });
    }
  }

  return Array.from(rentalMap.values()).map((rental) => ({
    ...rental,
    cogs: 0,
    productType: "RENTAL" as const,
    unitCost: 0,
    grossProfit: rental.revenue,
  }));
}

/** Retail revenue from physical stock counts; non-retail (e.g. rental) from paid kasir lines. */
export async function computePhysicalTotalRevenue(
  ctx: QueryCtx | MutationCtx,
  shiftId: Id<"shifts">,
  businessId: Id<"businesses">,
  stockRows: PhysicalStockSoldRow[],
  asOf: number,
): Promise<number> {
  const retailTiers = await allocatePhysicalRetailTiers(
    ctx,
    shiftId,
    businessId,
    stockRows,
    asOf,
    false,
  );
  const physicalRetail = retailTiers.reduce((sum, tier) => sum + tier.revenue, 0);

  const rentalTiers = await loadRentalPriceTiers(ctx, shiftId);
  const nonRetailPaid = rentalTiers.reduce((sum, tier) => sum + tier.revenue, 0);

  return physicalRetail + nonRetailPaid;
}

/** Sales breakdown from physical stock (retail) + paid kasir lines (rental). */
export async function buildPhysicalSalesByPriceTier(
  ctx: QueryCtx | MutationCtx,
  shiftId: Id<"shifts">,
  businessId: Id<"businesses">,
  stockRows: PhysicalStockSoldRow[],
  includeCost: boolean,
  asOf: number,
) {
  const retailTiers = await allocatePhysicalRetailTiers(
    ctx,
    shiftId,
    businessId,
    stockRows,
    asOf,
    includeCost,
  );
  const rentalTiers = await loadRentalPriceTiers(ctx, shiftId);

  return [...retailTiers, ...rentalTiers].sort((a, b) =>
    a.productName.localeCompare(b.productName),
  );
}

/** Legacy summaries may only include kasir tiers while physical stock sold more units. */
export function shouldRebuildClosedPhysicalTiers(
  savedTiers: Array<{ productId: Id<"products">; qty: number; productType?: string }>,
  stockRows: Array<{ productId: Id<"products">; soldQtyFromStock: number }>,
): boolean {
  if (stockRows.length === 0) return false;
  if (savedTiers.length === 0) return true;

  const savedRetailQtyByProduct = new Map<string, number>();
  for (const tier of savedTiers) {
    if (tier.productType === "RENTAL") continue;
    savedRetailQtyByProduct.set(
      tier.productId,
      (savedRetailQtyByProduct.get(tier.productId) ?? 0) + tier.qty,
    );
  }

  for (const row of stockRows) {
    if (row.soldQtyFromStock <= 0) continue;
    const savedQty = savedRetailQtyByProduct.get(row.productId) ?? 0;
    if (savedQty < row.soldQtyFromStock) return true;
  }

  return false;
}
