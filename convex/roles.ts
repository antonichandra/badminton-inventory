import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const DEFAULT_ROLES = [
  {
    name: "SUPER_ADMIN",
    description: "Platform owner — full system & user management",
    acl: [
      "master_produk",
      "master_role",
      "master_akun",
      "master_business",
      "master_plan",
      "business",
      "kasir",
      "analytics",
    ],
    isSystem: true,
  },
  {
    name: "ADMIN",
    description: "Business owner — manage own court inventory",
    acl: ["business", "master_produk", "master_akun", "kasir", "analytics"],
    isSystem: true,
  },
  {
    name: "STAFF",
    description: "Cashier staff access",
    acl: ["kasir"],
    isSystem: true,
  },
  {
    name: "PENDING",
    description: "Awaiting admin approval — no menu access",
    acl: [] as string[],
    isSystem: true,
  },
] as const;

export const seedRoles = mutation({
  args: {},
  handler: async (ctx) => {
    const results: string[] = [];

    for (const role of DEFAULT_ROLES) {
      const existing = await ctx.db
        .query("roles")
        .withIndex("by_name", (q) => q.eq("name", role.name))
        .unique();

      if (!existing) {
        await ctx.db.insert("roles", {
          name: role.name,
          description: role.description,
          acl: [...role.acl],
          isSystem: role.isSystem,
        });
        results.push(`Created role: ${role.name}`);
      } else {
        await ctx.db.patch(existing._id, {
          description: role.description,
          acl: [...role.acl],
          isSystem: role.isSystem,
        });
        results.push(`Synced role: ${role.name}`);
      }
    }

    return results;
  },
});

export const listRoles = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("roles").collect();
  },
});

export const getRoleByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("roles")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
  },
});
