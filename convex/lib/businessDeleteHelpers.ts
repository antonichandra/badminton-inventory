import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { isBusinessOperational } from "./businessHelpers";
import { forceDeleteShift } from "./shiftReportHelpers";

export async function deleteBusinessCompletely(
  ctx: MutationCtx,
  businessId: Id<"businesses">,
) {
  const business = await ctx.db.get(businessId);
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const shifts = await ctx.db
    .query("shifts")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();
  for (const shift of shifts) {
    await forceDeleteShift(ctx, shift._id);
  }

  const receiptItems = await ctx.db
    .query("stockReceiptItems")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();
  for (const item of receiptItems) {
    await ctx.db.delete(item._id);
  }

  const receipts = await ctx.db
    .query("stockReceipts")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();
  for (const receipt of receipts) {
    await ctx.db.delete(receipt._id);
  }

  const costHistory = await ctx.db
    .query("supplierCostHistory")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();
  for (const entry of costHistory) {
    await ctx.db.delete(entry._id);
  }

  const rollups = await ctx.db
    .query("businessDailyRollups")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();
  for (const rollup of rollups) {
    await ctx.db.delete(rollup._id);
  }

  const priceHistory = await ctx.db
    .query("sellPriceHistory")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();
  for (const entry of priceHistory) {
    await ctx.db.delete(entry._id);
  }

  const products = await ctx.db
    .query("products")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();
  for (const product of products) {
    await ctx.db.delete(product._id);
  }

  const suppliers = await ctx.db
    .query("suppliers")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();
  for (const supplier of suppliers) {
    await ctx.db.delete(supplier._id);
  }

  const invitations = await ctx.db
    .query("staffInvitations")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();
  for (const invitation of invitations) {
    await ctx.db.delete(invitation._id);
  }

  const memberships = await ctx.db
    .query("businessMembers")
    .withIndex("by_businessId", (q) => q.eq("businessId", businessId))
    .collect();
  for (const membership of memberships) {
    await ctx.db.delete(membership._id);
  }

  const owner = await ctx.db.get(business.ownerId);
  if (owner) {
    const owned = await ctx.db
      .query("businesses")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", owner._id))
      .collect();
    const remaining = owned
      .filter(
        (item) => item._id !== businessId && isBusinessOperational(item),
      )
      .sort((a, b) => a.createdAt - b.createdAt);

    const userUpdates: {
      defaultBusinessId?: Id<"businesses">;
      activeBusinessId?: Id<"businesses">;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (owner.defaultBusinessId === businessId) {
      userUpdates.defaultBusinessId = remaining[0]?._id;
    }
    if (owner.activeBusinessId === businessId) {
      userUpdates.activeBusinessId = remaining[0]?._id;
    }

    if (
      userUpdates.defaultBusinessId !== undefined ||
      userUpdates.activeBusinessId !== undefined
    ) {
      await ctx.db.patch(owner._id, userUpdates);
    }
  }

  await ctx.db.delete(businessId);

  return { success: true as const };
}
