import type { BadgeVariant } from "../components/table/types";

export function formatRoleName(roleName: string): string {
  return roleName.replace(/_/g, " ");
}

export function roleBadgeVariant(roleName: string): BadgeVariant {
  if (roleName === "SUPER_ADMIN") return "danger";
  if (roleName === "ADMIN") return "info";
  if (roleName === "STAFF") return "default";
  if (roleName === "PENDING") return "warning";
  return "default";
}
