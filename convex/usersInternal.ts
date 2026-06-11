import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getRoleById, getUserBySessionToken } from "./lib/authHelpers";

const googleUserValidator = v.object({
  sub: v.string(),
  email: v.string(),
  name: v.string(),
  picture: v.optional(v.string()),
});

export const registerPendingAdmin = internalMutation({
  args: {
    sessionToken: v.string(),
    googleUser: googleUserValidator,
  },
  handler: async (ctx, args) => {
    const sessionData = await getUserBySessionToken(ctx, args.sessionToken);
    if (!sessionData) {
      throw new Error("UNAUTHORIZED");
    }

    const callerRole = await getRoleById(ctx, sessionData.user.roleId);
    const canRegisterAdmin =
      callerRole?.acl.includes("master_akun") === true &&
      sessionData.user.status === "APPROVED";

    if (!canRegisterAdmin) {
      throw new Error("FORBIDDEN");
    }

    if (
      args.googleUser.email.toLowerCase() ===
      sessionData.user.email.toLowerCase()
    ) {
      throw new Error("CANNOT_REGISTER_SELF");
    }

    const adminRole = await ctx.db
      .query("roles")
      .withIndex("by_name", (q) => q.eq("name", "ADMIN"))
      .unique();

    if (!adminRole) {
      throw new Error("ADMIN role not found. Run roles:seedRoles first.");
    }

    const now = Date.now();
    const { googleUser } = args;

    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", googleUser.email))
      .unique();

    if (user) {
      if (user.status === "APPROVED") {
        throw new Error("USER_ALREADY_APPROVED");
      }

      await ctx.db.patch(user._id, {
        name: googleUser.name,
        picture: googleUser.picture,
        googleId: googleUser.sub,
        status: "PENDING",
        roleId: adminRole._id,
        updatedAt: now,
      });

      user = (await ctx.db.get(user._id))!;
    } else {
      const userId = await ctx.db.insert("users", {
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
        googleId: googleUser.sub,
        status: "PENDING",
        roleId: adminRole._id,
        theme: "light",
        language: "ID",
        createdAt: now,
        updatedAt: now,
      });

      user = (await ctx.db.get(userId))!;
    }

    return {
      userId: user._id,
      email: user.email,
      name: user.name,
      status: user.status,
      roleName: adminRole.name,
    };
  },
});
