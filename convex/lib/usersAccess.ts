import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getRoleById, getUserBySessionToken } from "./authHelpers";
import { canManageAllBusinesses } from "./rbac";

export interface UsersAccessContext {
  user: Doc<"users">;
  role: Doc<"roles">;
  isSuperAdmin: boolean;
  ownedBusinessIds: Id<"businesses">[] | null;
}

export async function getUsersAccessContext(
  ctx: QueryCtx,
  sessionToken: string,
): Promise<UsersAccessContext> {
  const sessionData = await getUserBySessionToken(ctx, sessionToken);
  if (!sessionData) {
    throw new Error("UNAUTHORIZED");
  }

  const role = await getRoleById(ctx, sessionData.user.roleId);
  if (!role?.acl.includes("master_akun") || sessionData.user.status !== "APPROVED") {
    throw new Error("FORBIDDEN");
  }

  const isSuperAdmin = canManageAllBusinesses(role);

  if (isSuperAdmin) {
    return {
      user: sessionData.user,
      role,
      isSuperAdmin: true,
      ownedBusinessIds: null,
    };
  }

  const ownedBusinesses = await ctx.db
    .query("businesses")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", sessionData.user._id))
    .collect();

  return {
    user: sessionData.user,
    role,
    isSuperAdmin: false,
    ownedBusinessIds: ownedBusinesses
      .filter((business) => business.isActive)
      .map((business) => business._id),
  };
}
