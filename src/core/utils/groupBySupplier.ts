export const UNASSIGNED_SUPPLIER_LABEL = "Tanpa Supplier";

export interface SupplierAssignable {
  productId: string;
  suppliers?: Array<{
    supplierId: string;
    supplierName: string;
  }>;
}

export interface SupplierGroup<T extends SupplierAssignable> {
  supplierId?: string;
  supplierName: string;
  items: T[];
}

export function groupBySupplier<T extends SupplierAssignable>(
  items: T[],
  unassignedLabel = UNASSIGNED_SUPPLIER_LABEL,
): SupplierGroup<T>[] {
  const map = new Map<string, SupplierGroup<T>>();

  for (const item of items) {
    const assigned = item.suppliers ?? [];
    if (assigned.length === 0) {
      const key = "__unassigned__";
      const group = map.get(key) ?? {
        supplierId: undefined,
        supplierName: unassignedLabel,
        items: [],
      };
      group.items.push(item);
      map.set(key, group);
      continue;
    }

    for (const supplier of assigned) {
      const key = supplier.supplierId;
      const group = map.get(key) ?? {
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        items: [],
      };
      group.items.push(item);
      map.set(key, group);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const aUnassigned = a.supplierName === unassignedLabel;
    const bUnassigned = b.supplierName === unassignedLabel;
    if (aUnassigned && !bUnassigned) return 1;
    if (!aUnassigned && bUnassigned) return -1;
    return a.supplierName.localeCompare(b.supplierName);
  });
}
