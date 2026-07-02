import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Calculator,
  ClipboardList,
  Database,
  Layers,
  Receipt,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Tags,
  Truck,
  Users,
} from "lucide-react";

export const MENU_ICONS: Record<string, LucideIcon> = {
  business: Building2,
  kasir: ShoppingCart,
  inventory: Layers,
  master: Database,
  "master-produk": ShoppingBag,
  "master-kategori-produk": Tags,
  "master-supplier": Truck,
  "master-penerimaan-barang": ClipboardList,
  "master-role": Shield,
  "master-akun": Users,
  "master-kalkulator": Calculator,
  analytics: Receipt,
};
