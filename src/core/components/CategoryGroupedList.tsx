import type { ReactNode } from "react";
import type { Categorizable, CategoryGroup } from "../utils/groupByCategory";
import {
  CategoryGroupSection,
  CategoryGroupsContainer,
  compactListItemClass,
} from "./categoryGroup";

interface CategoryGroupedListProps<T extends Categorizable> {
  groups: CategoryGroup<T>[];
  renderItem: (item: T, index: number) => ReactNode;
  defaultExpanded?: boolean;
  itemCountLabel?: (count: number) => string;
  getGroupMeta?: (group: CategoryGroup<T>) => ReactNode;
  className?: string;
}

export function CategoryGroupedList<T extends Categorizable>({
  groups,
  renderItem,
  defaultExpanded = true,
  itemCountLabel = (count) => `${count} item`,
  getGroupMeta,
  className,
}: CategoryGroupedListProps<T>) {
  if (groups.length === 0) return null;

  return (
    <CategoryGroupsContainer className={className}>
      {groups.map((group) => (
        <CategoryGroupSection
          key={group.categoryId ?? group.categoryName}
          categoryName={group.categoryName}
          itemCountLabel={itemCountLabel(group.items.length)}
          meta={getGroupMeta?.(group)}
          collapsible
          defaultExpanded={defaultExpanded}
        >
          <div>
            {group.items.map((item, index) => (
              <div key={index} className={compactListItemClass}>
                {renderItem(item, index)}
              </div>
            ))}
          </div>
        </CategoryGroupSection>
      ))}
    </CategoryGroupsContainer>
  );
}
