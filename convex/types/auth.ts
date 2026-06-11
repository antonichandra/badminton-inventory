import type { Id } from "../_generated/dataModel";

export interface AuthResult {
  sessionToken: string;
  user: {
    _id: Id<"users">;
    email: string;
    name: string;
    picture?: string;
    status: "PENDING" | "APPROVED" | "REVOKED";
    roleId: Id<"roles">;
    theme: "light" | "dark";
    language: "ID" | "EN";
  };
  role: {
    _id: Id<"roles">;
    name: string;
    acl: string[];
  } | null;
}
