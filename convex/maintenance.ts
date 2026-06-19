import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getRoleById, getUserBySessionToken } from "./lib/authHelpers";
import { resetAllInventoryData } from "./lib/inventoryResetHelpers";
import { deleteStaffUserRecords } from "./lib/staffUserCleanup";
import { forceDeleteShift } from "./lib/shiftReportHelpers";

/** Ops-only: removes all staff invitations and staff accounts for a business. */
export const cleanupBusinessStaffByName = mutation({
  args: {
    businessName: v.string(),
  },
  handler: async (ctx, args) => {
    const targetName = args.businessName.trim().toLowerCase();
    const businesses = await ctx.db.query("businesses").collect();
    const business = businesses.find(
      (item) => item.name.trim().toLowerCase() === targetName,
    );

    if (!business) {
      throw new Error(`BUSINESS_NOT_FOUND: ${args.businessName}`);
    }

    const summary = {
      businessId: business._id,
      businessName: business.name,
      invitationsDeleted: 0,
      staffUsersDeleted: 0,
      membershipsDeleted: 0,
    };

    const invitations = await ctx.db
      .query("staffInvitations")
      .withIndex("by_businessId", (q) => q.eq("businessId", business._id))
      .collect();

    for (const invitation of invitations) {
      await ctx.db.delete(invitation._id);
      summary.invitationsDeleted += 1;
    }

    const members = await ctx.db
      .query("businessMembers")
      .withIndex("by_businessId", (q) => q.eq("businessId", business._id))
      .collect();

    const processedEmails = new Set<string>();

    for (const member of members) {
      if (member.role !== "STAFF") {
        continue;
      }

      const staffUser = await ctx.db.get(member.userId);
      if (!staffUser) {
        await ctx.db.delete(member._id);
        summary.membershipsDeleted += 1;
        continue;
      }

      const emailKey = staffUser.email.trim().toLowerCase();
      if (processedEmails.has(emailKey)) {
        await ctx.db.delete(member._id);
        summary.membershipsDeleted += 1;
        continue;
      }

      processedEmails.add(emailKey);
      const role = await getRoleById(ctx, staffUser.roleId);

      if (role?.name === "STAFF") {
        await deleteStaffUserRecords(ctx, staffUser.email);
        summary.staffUsersDeleted += 1;
      } else {
        await ctx.db.delete(member._id);
        summary.membershipsDeleted += 1;
      }
    }

    return summary;
  },
});

/** Ops-only: list business names (for running other maintenance commands). */
export const listBusinessNames = mutation({
  args: {},
  handler: async (ctx) => {
    const businesses = await ctx.db.query("businesses").collect();
    return businesses.map((b) => ({ id: b._id, name: b.name }));
  },
});

/** Ops-only: wipes all shifts, batches, sales, and rollups for a business. Products are kept. */
export const resetBusinessShiftData = mutation({
  args: {
    businessName: v.string(),
  },
  handler: async (ctx, args) => {
    const targetName = args.businessName.trim().toLowerCase();
    const businesses = await ctx.db.query("businesses").collect();
    const business = businesses.find(
      (item) => item.name.trim().toLowerCase() === targetName,
    );

    if (!business) {
      throw new Error(`BUSINESS_NOT_FOUND: ${args.businessName}`);
    }

    const summary = {
      businessId: business._id,
      businessName: business.name,
      shiftsDeleted: 0,
      receiptItemsDeleted: 0,
      receiptsDeleted: 0,
      costHistoryDeleted: 0,
      rollupsDeleted: 0,
      sellPriceHistoryCleared: 0,
    };

    const shifts = await ctx.db
      .query("shifts")
      .withIndex("by_businessId", (q) => q.eq("businessId", business._id))
      .collect();

    for (const shift of shifts) {
      await forceDeleteShift(ctx, shift._id);
      summary.shiftsDeleted += 1;
    }

    const orphanItems = await ctx.db
      .query("stockReceiptItems")
      .withIndex("by_businessId", (q) => q.eq("businessId", business._id))
      .collect();
    for (const item of orphanItems) {
      await ctx.db.delete(item._id);
      summary.receiptItemsDeleted += 1;
    }

    const orphanReceipts = await ctx.db
      .query("stockReceipts")
      .withIndex("by_businessId", (q) => q.eq("businessId", business._id))
      .collect();
    for (const receipt of orphanReceipts) {
      await ctx.db.delete(receipt._id);
      summary.receiptsDeleted += 1;
    }

    const costHistory = await ctx.db
      .query("supplierCostHistory")
      .withIndex("by_businessId", (q) => q.eq("businessId", business._id))
      .collect();
    for (const entry of costHistory) {
      await ctx.db.delete(entry._id);
      summary.costHistoryDeleted += 1;
    }

    const rollups = await ctx.db
      .query("businessDailyRollups")
      .withIndex("by_businessId", (q) => q.eq("businessId", business._id))
      .collect();
    for (const rollup of rollups) {
      await ctx.db.delete(rollup._id);
      summary.rollupsDeleted += 1;
    }

    const priceHistory = await ctx.db
      .query("sellPriceHistory")
      .withIndex("by_businessId", (q) => q.eq("businessId", business._id))
      .collect();
    for (const entry of priceHistory) {
      if (entry.shiftId !== undefined) {
        await ctx.db.patch(entry._id, { shiftId: undefined });
        summary.sellPriceHistoryCleared += 1;
      }
    }

    return summary;
  },
});

/** Super admin only: wipes all inventory, shift, and sales data. Keeps users and businesses. */
export const resetInventoryData = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const sessionData = await getUserBySessionToken(ctx, args.sessionToken);
    if (!sessionData) {
      throw new Error("UNAUTHORIZED");
    }

    const callerRole = await getRoleById(ctx, sessionData.user.roleId);
    if (!callerRole || callerRole.name !== "SUPER_ADMIN") {
      throw new Error("FORBIDDEN");
    }

    if (sessionData.user.status !== "APPROVED") {
      throw new Error("FORBIDDEN");
    }

    return await resetAllInventoryData(ctx);
  },
});
