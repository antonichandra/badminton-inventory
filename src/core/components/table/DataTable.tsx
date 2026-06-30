import { cn } from "../../utils/cn";
import { Badge } from "./Badge";
import { TableSkeletonRows } from "./TableSkeletonRows";
import type { TableColumnConfig } from "./types";

interface DataTableProps<T> {
  columns: TableColumnConfig<T>[];
  data: T[];
  emptyMessage?: string;
  getRowKey: (row: T) => string;
  isLoading?: boolean;
  skeletonRowCount?: number;
  /** No outer border/radius — for nested category group tables */
  embedded?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  emptyMessage = "Tidak ada data",
  getRowKey,
  isLoading = false,
  skeletonRowCount = 6,
  embedded = false,
}: DataTableProps<T>) {
  const thClass = embedded
    ? "px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
    : "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";
  const tdClass = embedded
    ? "px-2.5 py-1.5 align-middle"
    : "px-4 py-3 align-middle";
  const emptyCellClass = embedded
    ? "px-2.5 py-6 text-center text-xs text-slate-500"
    : "px-4 py-10 text-center text-sm text-slate-500";
  const renderCell = (column: TableColumnConfig<T>, row: T) => {
    switch (column.type) {
      case "display":
        return (
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {column.getValue(row)}
          </span>
        );
      case "badge":
        return (
          <Badge variant={column.getVariant?.(row) ?? "default"}>
            {column.getValue(row)}
          </Badge>
        );
      case "custom":
        return column.render(row);
      default:
        return null;
    }
  };

  const table = (
    <table
      className={cn(
        "min-w-full divide-y divide-slate-200 dark:divide-slate-800",
        embedded && "text-xs",
      )}
    >
      <thead className="bg-slate-50 dark:bg-slate-800/50">
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              className={cn(thClass, column.headerClassName)}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {isLoading ? (
          <TableSkeletonRows
            columnCount={columns.length}
            rowCount={skeletonRowCount}
          />
        ) : data.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className={emptyCellClass}>
              {emptyMessage}
            </td>
          </tr>
        ) : (
          data.map((row) => (
            <tr
              key={getRowKey(row)}
              className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(tdClass, column.className)}
                >
                  {renderCell(column, row)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  if (embedded) {
    return table;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">{table}</div>
    </div>
  );
}
