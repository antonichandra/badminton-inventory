import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  getRoleById,
  getSessionExpiry,
  getUserBySessionToken,
} from "./lib/authHelpers";
import { themePreference, languagePreference } from "./schema";

export const getCurrentUser = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const sessionData = await getUserBySessionToken(ctx, args.sessionToken);
    if (!sessionData) {
      return null;
    }

    const { user } = sessionData;
    const role = await getRoleById(ctx, user.roleId);

    return {
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        status: user.status,
        roleId: user.roleId,
        theme: user.theme,
        language: user.language,
      },
      role: role
        ? {
            _id: role._id,
            name: role.name,
            acl: role.acl,
          }
        : null,
    };
  },
});

export const checkApprovalStatus = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const sessionData = await getUserBySessionToken(ctx, args.sessionToken);
    if (!sessionData) {
      return { authenticated: false as const };
    }

    return {
      authenticated: true as const,
      status: sessionData.user.status,
      email: sessionData.user.email,
      name: sessionData.user.name,
    };
  },
});

export const updateProfile = mutation({
  args: {
    sessionToken: v.string(),
    theme: v.optional(themePreference),
    language: v.optional(languagePreference),
  },
  handler: async (ctx, args) => {
    const sessionData = await getUserBySessionToken(ctx, args.sessionToken);
    if (!sessionData) {
      throw new Error("UNAUTHORIZED");
    }

    const updates: {
      theme?: "light" | "dark";
      language?: "ID" | "EN";
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.theme !== undefined) {
      updates.theme = args.theme;
    }
    if (args.language !== undefined) {
      updates.language = args.language;
    }

    await ctx.db.patch(sessionData.user._id, updates);

    const updatedUser = (await ctx.db.get(sessionData.user._id))!;
    const role = await getRoleById(ctx, updatedUser.roleId);

    return {
      user: {
        _id: updatedUser._id,
        email: updatedUser.email,
        name: updatedUser.name,
        picture: updatedUser.picture,
        status: updatedUser.status,
        roleId: updatedUser.roleId,
        theme: updatedUser.theme,
        language: updatedUser.language,
      },
      role: role
        ? {
            _id: role._id,
            name: role.name,
            acl: role.acl,
          }
        : null,
    };
  },
});

export const logout = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .unique();

    if (session) {
      await ctx.db.delete(session._id);
    }

    return { success: true };
  },
});

export const refreshSession = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const sessionData = await getUserBySessionToken(ctx, args.sessionToken);
    if (!sessionData) {
      return null;
    }

    await ctx.db.patch(sessionData.sessionId, {
      expiresAt: getSessionExpiry(),
    });

    return { success: true };
  },
});
