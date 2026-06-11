import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { getRoleById, getUserBySessionToken } from "./authHelpers";

export async function getAuthenticatedUser(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
) {
  const sessionData = await getUserBySessionToken(ctx, sessionToken);
  if (!sessionData) {
    throw new Error("UNAUTHORIZED");
  }

  const role = await getRoleById(ctx, sessionData.user.roleId);
  if (!role) {
    throw new Error("FORBIDDEN");
  }

  return {
    user: sessionData.user,
    role,
  };
}

export function hasAcl(role: Doc<"roles">, permission: string): boolean {
  return role.acl.includes(permission);
}

export function assertAcl(role: Doc<"roles">, permission: string) {
  if (!hasAcl(role, permission)) {
    throw new Error("FORBIDDEN");
  }
}

export function isSuperAdmin(role: Doc<"roles">): boolean {
  return role.name === "SUPER_ADMIN";
}

export function isAdmin(role: Doc<"roles">): boolean {
  return role.name === "ADMIN";
}

export function canManageAllBusinesses(role: Doc<"roles">): boolean {
  return hasAcl(role, "master_business");
}

export function canManageOwnBusinesses(role: Doc<"roles">): boolean {
  return hasAcl(role, "business");
}
