import { cn } from "../../utils/cn";
import { Badge } from "./Badge";
import type { TableColumnConfig } from "./types";

interface DataTableProps<T> {
  columns: TableColumnConfig<T>[];
  data: T[];
  emptyMessage?: string;
  getRowKey: (row: T) => string;
  isLoading?: boolean;
  loadingMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  emptyMessage = "Tidak ada data",
  getRowKey,
  isLoading = false,
  loadingMessage = "Memuat data...",
}: DataTableProps<T>) {
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

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400",
                    column.headerClassName,
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  {loadingMessage}
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
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
                      className={cn("px-4 py-3 align-middle", column.className)}
                    >
                      {renderCell(column, row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
