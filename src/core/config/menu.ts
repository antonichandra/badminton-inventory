import type { AclPermission, MenuItem } from "../../types/auth";

export const MENU_CONFIG: MenuItem[] = [
  {
    id: "kasir",
    labelKey: "menuKasir",
    path: "/kasir",
    permission: "kasir",
  },
  {
    id: "master",
    labelKey: "menuMaster",
    children: [
      {
        id: "business",
        labelKey: "menuBusiness",
        path: "/business",
        permissions: ["business", "master_business"],
      },
      {
        id: "master-produk",
        labelKey: "menuProduk",
        path: "/master/produk",
        permission: "master_produk",
      },
      {
        id: "master-kategori-produk",
        labelKey: "menuKategoriProduk",
        path: "/master/kategori-produk",
        permission: "master_produk",
      },
      {
        id: "master-supplier",
        labelKey: "menuSupplier",
        path: "/master/supplier",
        permission: "master_produk",
      },
      {
        id: "master-penerimaan-barang",
        labelKey: "menuPenerimaanBarang",
        path: "/master/penerimaan-barang",
        permissions: ["master_produk", "kasir"],
      },
      {
        id: "master-role",
        labelKey: "menuRole",
        path: "/master/role",
        permission: "master_role",
      },
      {
        id: "master-akun",
        labelKey: "menuAkun",
        path: "/master/akun",
        permission: "master_akun",
      },
      {
        id: "master-kalkulator",
        labelKey: "menuKalkulator",
        path: "/master/kalkulator",
        permission: "kasir",
      },
    ],
  },
];

function itemVisible(item: MenuItem, acl: AclPermission[]): boolean {
  if (item.permissions?.length) {
    return item.permissions.some((permission) => acl.includes(permission));
  }
  if (item.permission) {
    return acl.includes(item.permission);
  }
  return true;
}

export function filterMenuByAcl(
  menu: MenuItem[],
  acl: AclPermission[],
): MenuItem[] {
  return menu
    .map((item) => {
      if (item.children) {
        const filteredChildren = item.children.filter((child) =>
          itemVisible(child, acl),
        );
        if (filteredChildren.length === 0) return null;
        return { ...item, children: filteredChildren };
      }
      if (!itemVisible(item, acl)) return null;
      return item;
    })
    .filter((item): item is MenuItem => item !== null);
}

export function hasPermission(
  acl: AclPermission[],
  permission: AclPermission,
): boolean {
  return acl.includes(permission);
}

export function hasAnyPermission(
  acl: AclPermission[],
  permissions: AclPermission[],
): boolean {
  return permissions.some((permission) => acl.includes(permission));
}
