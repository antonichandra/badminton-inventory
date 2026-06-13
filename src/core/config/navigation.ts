import type { MenuItem } from "../../types/auth";

export const DASHBOARD_NAV: MenuItem = {
  id: "dashboard",
  labelKey: "navDashboard",
  path: "/dashboard",
};

export const ANALYTICS_NAV: MenuItem = {
  id: "analytics",
  labelKey: "menuAnalytics",
  path: "/analytics",
};

const PRIMARY_MENU_IDS = ["kasir", "business"] as const;

export function buildPrimaryNavItems(filteredMenu: MenuItem[]): MenuItem[] {
  const items: MenuItem[] = [DASHBOARD_NAV, ANALYTICS_NAV];

  for (const id of PRIMARY_MENU_IDS) {
    const item = filteredMenu.find((entry) => entry.id === id && entry.path);
    if (item) {
      items.push(item);
    }
  }

  return items;
}

export function getMasterGroup(filteredMenu: MenuItem[]): MenuItem | null {
  const master = filteredMenu.find((entry) => entry.id === "master");
  if (!master?.children?.length) {
    return null;
  }
  return master;
}

export function getSecondaryMenuItems(filteredMenu: MenuItem[]): MenuItem[] {
  return filteredMenu.filter(
    (entry) =>
      entry.id !== "kasir" &&
      entry.id !== "business" &&
      entry.id !== "master" &&
      entry.path,
  );
}

export function isMasterRoute(pathname: string): boolean {
  return pathname.startsWith("/master");
}
