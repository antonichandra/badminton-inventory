import type { Id } from "../../convex/_generated/dataModel";

export type UserStatus = "PENDING" | "APPROVED" | "REVOKED";
export type ThemePreference = "light" | "dark";
export type LanguagePreference = "ID" | "EN";

export type AclPermission =
  | "master_produk"
  | "master_role"
  | "master_akun"
  | "master_business"
  | "master_plan"
  | "business"
  | "kasir";

export interface Role {
  _id: Id<"roles">;
  name: string;
  acl: AclPermission[];
}

export interface User {
  _id: Id<"users">;
  email: string;
  name: string;
  picture?: string;
  status: UserStatus;
  roleId: Id<"roles">;
  theme: ThemePreference;
  language: LanguagePreference;
}

export interface AuthSession {
  sessionToken: string;
  user: User;
  role: Role | null;
  savedAt: number;
}

export interface MenuItem {
  id: string;
  labelKey: string;
  path?: string;
  permission?: AclPermission;
  permissions?: AclPermission[];
  children?: MenuItem[];
}

export interface MenuGroup extends MenuItem {
  children: MenuItem[];
}
