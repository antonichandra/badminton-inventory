import type { ReactNode } from "react";
import {
  CategoryGroupedTable,
  compactTdClass,
  compactThClass,
} from "../../core/components/categoryGroup";
import { cn } from "../../core/utils/cn";

interface CategorizableStockRow {
  productId: string;
  productName: string;
  categoryId?: string;
  categoryName?: string;
}

interface GroupedStockTableProps<T extends CategorizableStockRow> {
  rows: T[];
  headers: ReactNode;
  renderRow: (row: T) => ReactNode;
  itemCountLabel: (count: number) => string;
  getGroupMeta?: (group: {
    items: T[];
    categoryName: string;
  }) => ReactNode;
}

export function GroupedStockTable<T extends CategorizableStockRow>({
  rows,
  headers,
  renderRow,
  itemCountLabel,
  getGroupMeta,
}: GroupedStockTableProps<T>) {
  return (
    <CategoryGroupedTable
      rows={rows}
      getRowKey={(row) => row.productId}
      itemCountLabel={itemCountLabel}
      getGroupMeta={getGroupMeta}
      headers={headers}
      renderRow={renderRow}
    />
  );
}

export function GroupedStockTh({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <th className={cn(compactThClass, className)}>{children}</th>;
}

export function GroupedStockTd({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <td className={cn(compactTdClass, className)}>{children}</td>;
}
