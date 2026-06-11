import { Navigate } from "react-router-dom";
import type { AclPermission } from "../../types/auth";
import { hasAnyPermission, hasPermission } from "../config/menu";
import { useAuth } from "../context/AuthContext";

interface PermissionGuardProps {
  permission?: AclPermission;
  permissions?: AclPermission[];
  children: React.ReactNode;
}

export function PermissionGuard({
  permission,
  permissions,
  children,
}: PermissionGuardProps) {
  const { acl } = useAuth();

  const allowed = permissions?.length
    ? hasAnyPermission(acl, permissions)
    : permission
      ? hasPermission(acl, permission)
      : true;

  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
