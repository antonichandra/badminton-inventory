import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Database,
  Layers,
  Package,
  Receipt,
  Shield,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";

export const MENU_ICONS: Record<string, LucideIcon> = {
  business: Building2,
  kasir: ShoppingCart,
  inventory: Layers,
  master: Database,
  "master-produk": Package,
  "master-supplier": Truck,
  "master-role": Shield,
  "master-akun": Users,
  analytics: Receipt,
};
