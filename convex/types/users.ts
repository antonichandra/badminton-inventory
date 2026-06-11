import type { Id } from "../_generated/dataModel";

export interface RegisterPendingAdminResult {
  userId: Id<"users">;
  email: string;
  name: string;
  status: "PENDING" | "APPROVED" | "REVOKED";
  roleName: string;
}
