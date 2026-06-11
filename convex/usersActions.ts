import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getGoogleDisplayName, verifyGoogleIdToken } from "./lib/authHelpers";
import type { RegisterPendingAdminResult } from "./types/users";

export const registerPendingAdminWithGoogle = action({
  args: {
    sessionToken: v.string(),
    idToken: v.string(),
  },
  handler: async (ctx, args): Promise<RegisterPendingAdminResult> => {
    const googleUser = await verifyGoogleIdToken(args.idToken);

    return await ctx.runMutation(internal.usersInternal.registerPendingAdmin, {
      sessionToken: args.sessionToken,
      googleUser: {
        sub: googleUser.sub,
        email: googleUser.email,
        name: getGoogleDisplayName(googleUser),
        picture: googleUser.picture,
      },
    });
  },
});
