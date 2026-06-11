import type { Doc } from "../_generated/dataModel";

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
