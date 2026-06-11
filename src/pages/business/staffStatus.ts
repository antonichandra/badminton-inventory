export type StaffInvitationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "EXPIRED"
  | "REVOKED";

export type StaffDisplayStatus = "PENDING" | "APPROVED" | "REVOKED" | "EXPIRED";

export function toStaffDisplayStatus(
  status: StaffInvitationStatus,
): StaffDisplayStatus {
  if (status === "ACCEPTED") {
    return "APPROVED";
  }
  return status;
}

export function formatInvitationRoleLabel(
  roleName: string | undefined,
  staffRoleLabel: string,
): string {
  if (!roleName || roleName === "STAFF") {
    return staffRoleLabel;
  }

  return roleName.replace(/_/g, " ");
}
