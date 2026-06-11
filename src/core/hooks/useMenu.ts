import { useMemo } from "react";
import type { MenuItem } from "../../types/auth";
import { MENU_CONFIG, filterMenuByAcl } from "../config/menu";
import { useAuth } from "../context/AuthContext";

export function useMenu(): MenuItem[] {
  const { acl } = useAuth();

  return useMemo(() => filterMenuByAcl(MENU_CONFIG, acl), [acl]);
}
