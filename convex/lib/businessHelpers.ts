import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export type ResolvedBusinessStatus = "ACTIVE" | "DELETE_REQUESTED";

export function resolveBusinessStatus(
  business: Pick<Doc<"businesses">, "status" | "isActive">,
): ResolvedBusinessStatus {
  if (!business.isActive) {
    return "DELETE_REQUESTED";
  }
  return business.status ?? "ACTIVE";
}

export function isBusinessOperational(
  business: Pick<Doc<"businesses">, "status" | "isActive">,
): boolean {
  return business.isActive && resolveBusinessStatus(business) === "ACTIVE";
}

export async function getBusinessOrThrow(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
) {
  const business = await ctx.db.get(businessId);
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }
  return business;
}
