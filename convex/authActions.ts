import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getGoogleDisplayName, verifyGoogleIdToken } from "./lib/authHelpers";
import type { AuthResult } from "./types/auth";

export const authenticateWithGoogle = action({
  args: { idToken: v.string() },
  handler: async (ctx, args): Promise<AuthResult> => {
    const googleUser = await verifyGoogleIdToken(args.idToken);
    return await ctx.runMutation(internal.authInternal.finishAuthentication, {
      googleUser: {
        sub: googleUser.sub,
        email: googleUser.email,
        name: getGoogleDisplayName(googleUser),
        picture: googleUser.picture,
      },
    });
  },
});
