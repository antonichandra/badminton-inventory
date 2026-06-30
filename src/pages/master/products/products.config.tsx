import { History, Pencil } from "lucide-react";
import type { FilterFieldConfig } from "../../../core/components/filters/types";
import type { TableColumnConfig } from "../../../core/components/table/types";
import { Badge } from "../../../core/components/table/Badge";
import { IconButton } from "../../../core/components/ui/IconButton";
import { cn } from "../../../core/utils/cn";
import type { Id } from "../../../../convex/_generated/dataModel";
import { formatRupiah } from "../../kasir/utils";

function hasPackConfig(row: ProductRow): boolean {
  return (
    row.unitsPerPurchaseUnit != null &&
    row.unitsPerPurchaseUnit >= 1 &&
    (row.purchaseUnit?.trim() ?? "") !== ""
  );
}

function formatPackSizeInfo(
  template: string,
  purchaseUnit: string,
  count: number,
  unit: string,
): string {
  return template
    .replace("{purchaseUnit}", purchaseUnit)
    .replace("{count}", String(count))
    .replace("{unit}", unit);
}

export type ProductStatusFilter = "ACTIVE" | "INACTIVE";
export type ProductTypeFilter = "RETAIL" | "RENTAL";
export type ProductTrackExpiryFilter = "TRACKED" | "NOT_TRACKED";

export interface ProductRow {
  _id: Id<"products">;
  name: string;
  type: "RETAIL" | "RENTAL";
  sellPrice: number;
  rentalPricePerHour?: number;
  unit: string;
  isActive: boolean;
  trackExpiry?: boolean;
  defaultUnitCost?: number;
  unitsPerPurchaseUnit?: number;
  purchaseUnit?: string;
  unitCost?: number | null;
  margin?: number | null;
  categoryId?: Id<"productCategories">;
  categoryName?: string;
}

interface ColumnLabels {
  name: string;
  type: string;
  price: string;
  buyPrice: string;
  margin: string;
  unit: string;
  packSizeInfo: string;
  trackExpiry: string;
  trackExpiryYes: string;
  trackExpiryNo: string;
  status: string;
  typeRetail: string;
  typeRental: string;
  active: string;
  inactive: string;
  edit: string;
  priceHistory: string;
}

interface FilterLabels {
  search: string;
  searchPlaceholder: string;
  type: string;
  typePlaceholder: string;
  status: string;
  statusPlaceholder: string;
  trackExpiry: string;
  trackExpiryPlaceholder: string;
  typeRetail: string;
  typeRental: string;
  active: string;
  inactive: string;
  trackExpiryYes: string;
  trackExpiryNo: string;
  category: string;
  categoryPlaceholder: string;
  uncategorized: string;
}

export function buildProductFilterFields(
  labels: FilterLabels,
  categoryOptions: { value: string; label: string }[] = [],
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
      key: "types",
      type: "multi-dropdown",
      label: labels.type,
      placeholder: labels.typePlaceholder,
      settings: {
        options: [
          { value: "RETAIL", label: labels.typeRetail },
          { value: "RENTAL", label: labels.typeRental },
        ],
        maxDisplayTags: 2,
      },
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
        maxDisplayTags: 2,
      },
    },
    {
      key: "trackExpiry",
      type: "multi-dropdown",
      label: labels.trackExpiry,
      placeholder: labels.trackExpiryPlaceholder,
      settings: {
        options: [
          { value: "TRACKED", label: labels.trackExpiryYes },
          { value: "NOT_TRACKED", label: labels.trackExpiryNo },
        ],
        maxDisplayTags: 2,
      },
    },
    {
      key: "categories",
      type: "multi-dropdown",
      label: labels.category,
      placeholder: labels.categoryPlaceholder,
      settings: {
        options: [
          { value: "__uncategorized__", label: labels.uncategorized },
          ...categoryOptions,
        ],
        maxDisplayTags: 2,
      },
    },
  ];
}

export function buildProductTableColumns(
  labels: ColumnLabels,
  onEdit: (row: ProductRow) => void,
  onPriceHistory: (row: ProductRow) => void,
): TableColumnConfig<ProductRow>[] {
  return [
    {
      type: "custom",
      key: "name",
      label: labels.name,
      render: (row) => (
        <span className="text-sm font-medium text-slate-900 dark:text-white">
          {row.name}
        </span>
      ),
    },
    {
      type: "custom",
      key: "type",
      label: labels.type,
      render: (row) => (
        <Badge variant={row.type === "RENTAL" ? "info" : "default"}>
          {row.type === "RENTAL" ? labels.typeRental : labels.typeRetail}
        </Badge>
      ),
    },
    {
      type: "custom",
      key: "price",
      label: labels.price,
      render: (row) => (
        <span className="text-sm text-slate-700 dark:text-slate-300">
          {row.type === "RENTAL"
            ? formatRupiah(row.rentalPricePerHour ?? 0)
            : formatRupiah(row.sellPrice)}
        </span>
      ),
    },
    {
      type: "custom",
      key: "buyPrice",
      label: labels.buyPrice,
      render: (row) => {
        if (row.type !== "RETAIL" || row.unitCost == null) {
          return <span className="text-sm text-slate-400">—</span>;
        }

        const packConfigured = hasPackConfig(row);
        const packSize = row.unitsPerPurchaseUnit ?? 0;

        return (
          <div className="text-sm text-slate-700 dark:text-slate-300">
            <p>
              {formatRupiah(row.unitCost)}
              <span className="ml-1 text-xs text-slate-500">/ {row.unit}</span>
            </p>
            {packConfigured && (
              <p className="mt-0.5 text-xs text-slate-500">
                {formatRupiah(row.unitCost * packSize)}
                <span className="ml-1">/ {row.purchaseUnit}</span>
              </p>
            )}
          </div>
        );
      },
    },
    {
      type: "custom",
      key: "margin",
      label: labels.margin,
      render: (row) => (
        <span
          className={cn(
            "text-sm font-medium",
            row.type === "RETAIL" && row.margin != null
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-slate-400",
          )}
        >
          {row.type === "RETAIL" && row.margin != null
            ? formatRupiah(row.margin)
            : "—"}
        </span>
      ),
    },
    {
      type: "custom",
      key: "unit",
      label: labels.unit,
      render: (row) => {
        if (row.type !== "RETAIL") {
          return (
            <span className="text-sm text-slate-400">—</span>
          );
        }

        const packConfigured = hasPackConfig(row);

        return (
          <div className="text-sm text-slate-700 dark:text-slate-300">
            <p>{row.unit}</p>
            {packConfigured && (
              <p className="mt-0.5 text-xs text-slate-500">
                {formatPackSizeInfo(
                  labels.packSizeInfo,
                  row.purchaseUnit!,
                  row.unitsPerPurchaseUnit!,
                  row.unit,
                )}
              </p>
            )}
          </div>
        );
      },
    },
    {
      type: "custom",
      key: "trackExpiry",
      label: labels.trackExpiry,
      render: (row) => {
        if (row.type !== "RETAIL") {
          return <span className="text-sm text-slate-400">—</span>;
        }
        return (
          <Badge variant={row.trackExpiry ? "info" : "default"}>
            {row.trackExpiry ? labels.trackExpiryYes : labels.trackExpiryNo}
          </Badge>
        );
      },
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
        <div className="flex justify-end gap-1">
          <IconButton
            tooltip={labels.priceHistory}
            tooltipPlacement="left"
            onClick={() => onPriceHistory(row)}
            icon={<History className="h-4 w-4" />}
          />
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
