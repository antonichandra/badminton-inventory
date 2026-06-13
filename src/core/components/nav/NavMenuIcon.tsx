import { Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MENU_ICONS } from "../../config/menuIcons";

export function NavMenuIcon({
  itemId,
  className = "h-4 w-4 shrink-0",
}: {
  itemId: string;
  className?: string;
}) {
  const Icon: LucideIcon = MENU_ICONS[itemId] ?? Package;
  return <Icon className={className} />;
}
