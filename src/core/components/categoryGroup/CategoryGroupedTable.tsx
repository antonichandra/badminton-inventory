import type { ReactNode } from "react";
import {
  groupByCategory,
  type Categorizable,
  type CategoryGroup,
} from "../../utils/groupByCategory";
import { CategoryGroupSection } from "./CategoryGroupSection";
import { CategoryGroupsContainer } from "./CategoryGroupsContainer";
import {
  compactTableClass,
  compactTbodyClass,
  compactTheadClass,
  compactTrClass,
} from "./styles";

interface CategoryGroupedTableProps<T extends Categorizable & { productId?: string }> {
  rows: T[];
  getRowKey: (row: T) => string;
  headers: ReactNode;
  renderRow: (row: T) => ReactNode;
  itemCountLabel: (count: number) => string;
  getGroupMeta?: (group: CategoryGroup<T>) => ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

export function CategoryGroupedTable<T extends Categorizable & { productId?: string }>({
  rows,
  getRowKey,
  headers,
  renderRow,
  itemCountLabel,
  getGroupMeta,
  collapsible = false,
  defaultExpanded = true,
  className,
}: CategoryGroupedTableProps<T>) {
  const groups = groupByCategory(rows);

  if (groups.length === 0) return null;

  return (
    <CategoryGroupsContainer className={className}>
      {groups.map((group) => (
        <CategoryGroupSection
          key={group.categoryId ?? group.categoryName}
          categoryName={group.categoryName}
          itemCountLabel={itemCountLabel(group.items.length)}
          meta={getGroupMeta?.(group)}
          collapsible={collapsible}
          defaultExpanded={defaultExpanded}
        >
          <table className={compactTableClass}>
            <thead className={compactTheadClass}>{headers}</thead>
            <tbody className={compactTbodyClass}>
              {group.items.map((row) => (
                <tr key={getRowKey(row)} className={compactTrClass}>
                  {renderRow(row)}
                </tr>
              ))}
            </tbody>
          </table>
        </CategoryGroupSection>
      ))}
    </CategoryGroupsContainer>
  );
}
