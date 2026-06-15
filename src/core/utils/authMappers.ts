import type { Id } from "../../../convex/_generated/dataModel";
import type { AclPermission, Role, User } from "../../types/auth";

interface ApiRole {
  _id: Id<"roles">;
  name: string;
  acl: string[];
}

interface ApiUser {
  _id: Id<"users">;
  email: string;
  name: string;
  picture?: string;
  status: "PENDING" | "APPROVED" | "REVOKED";
  roleId: Id<"roles">;
  theme: "light" | "dark";
  language: "ID" | "EN";
}

const ACL_PERMISSIONS: ReadonlySet<string> = new Set([
  "master_produk",
  "master_role",
  "master_akun",
  "master_business",
  "master_plan",
  "business",
  "kasir",
  "analytics",
]);

export function toAclPermissions(acl: string[]): AclPermission[] {
  return acl.filter((permission): permission is AclPermission =>
    ACL_PERMISSIONS.has(permission),
  );
}

export function toRole(role: ApiRole | null): Role | null {
  if (!role) return null;
  return {
    _id: role._id,
    name: role.name,
    acl: toAclPermissions(role.acl),
  };
}

export function toUser(user: ApiUser): User {
  return {
    _id: user._id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    status: user.status,
    roleId: user.roleId,
    theme: user.theme,
    language: user.language,
  };
}
