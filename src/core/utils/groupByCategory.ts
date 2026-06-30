export const UNCATEGORIZED_LABEL = "Tanpa Kategori";

export interface Categorizable {
  categoryId?: string;
  categoryName?: string;
}

export interface CategoryGroup<T extends Categorizable> {
  categoryId?: string;
  categoryName: string;
  items: T[];
}

export function groupByCategory<T extends Categorizable>(
  items: T[],
): CategoryGroup<T>[] {
  const map = new Map<string, CategoryGroup<T>>();

  for (const item of items) {
    const categoryName = item.categoryName?.trim() || UNCATEGORIZED_LABEL;
    const key = item.categoryId ?? "__uncategorized__";
    const group = map.get(key) ?? {
      categoryId: item.categoryId,
      categoryName,
      items: [],
    };
    group.items.push(item);
    map.set(key, group);
  }

  return Array.from(map.values()).sort((a, b) => {
    const aUncategorized = a.categoryName === UNCATEGORIZED_LABEL;
    const bUncategorized = b.categoryName === UNCATEGORIZED_LABEL;
    if (aUncategorized && !bUncategorized) return 1;
    if (!aUncategorized && bUncategorized) return -1;
    return a.categoryName.localeCompare(b.categoryName);
  });
}
