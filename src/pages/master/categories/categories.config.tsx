import { Pencil } from "lucide-react";
import type { FilterFieldConfig } from "../../../core/components/filters/types";
import type { TableColumnConfig } from "../../../core/components/table/types";
import { IconButton } from "../../../core/components/ui/IconButton";
import type { Id } from "../../../../convex/_generated/dataModel";

export type CategoryStatusFilter = "ACTIVE" | "INACTIVE";

export interface CategoryRow {
  _id: Id<"productCategories">;
  name: string;
  sortOrder?: number;
  isActive: boolean;
  linkedProductCount?: number;
}

interface ColumnLabels {
  name: string;
  products: string;
  productsCount: string;
  sortOrder: string;
  status: string;
  active: string;
  inactive: string;
  edit: string;
}

interface FilterLabels {
  search: string;
  searchPlaceholder: string;
  status: string;
  statusPlaceholder: string;
  active: string;
  inactive: string;
}

export function buildCategoryFilterFields(
  labels: FilterLabels,
): FilterFieldConfig[] {
  return [
    {
      key: "search",
      type: "text",
      label: labels.search,
      placeholder: labels.searchPlaceholder,
      settings: { inputType: "search" },
    },
    {
      key: "statuses",
      type: "multi-dropdown",
      label: labels.status,
      placeholder: labels.statusPlaceholder,
      settings: {
        options: [
          { value: "ACTIVE", label: labels.active },
          { value: "INACTIVE", label: labels.inactive },
        ],
      },
    },
  ];
}

export function buildCategoryTableColumns(
  labels: ColumnLabels,
  onEdit: (row: CategoryRow) => void,
): TableColumnConfig<CategoryRow>[] {
  return [
    {
      type: "display",
      key: "name",
      label: labels.name,
      getValue: (row) => row.name,
    },
    {
      type: "display",
      key: "products",
      label: labels.products,
      getValue: (row) =>
        labels.productsCount.replace(
          "{count}",
          String(row.linkedProductCount ?? 0),
        ),
    },
    {
      type: "display",
      key: "sortOrder",
      label: labels.sortOrder,
      getValue: (row) =>
        row.sortOrder != null ? String(row.sortOrder) : "—",
    },
    {
      type: "badge",
      key: "status",
      label: labels.status,
      getValue: (row) => (row.isActive ? labels.active : labels.inactive),
      getVariant: (row) => (row.isActive ? "success" : "default"),
    },
    {
      type: "custom",
      key: "actions",
      label: "",
      headerClassName: "text-right",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end">
          <IconButton
            tooltip={labels.edit}
            tooltipPlacement="left"
            onClick={() => onEdit(row)}
            icon={<Pencil className="h-4 w-4" />}
          />
        </div>
      ),
    },
  ];
}
