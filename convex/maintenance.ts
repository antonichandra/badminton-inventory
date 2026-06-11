import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getRoleById } from "./lib/authHelpers";
import { deleteStaffUserRecords } from "./lib/staffUserCleanup";

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
