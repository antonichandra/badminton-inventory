import { History, Pencil } from "lucide-react";
import type { FilterFieldConfig } from "../../../core/components/filters/types";
import type { TableColumnConfig } from "../../../core/components/table/types";
import { Badge } from "../../../core/components/table/Badge";
import { IconButton } from "../../../core/components/ui/IconButton";
import type { Id } from "../../../../convex/_generated/dataModel";
import { formatRupiah } from "../../kasir/utils";

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
  unitCost?: number | null;
  margin?: number | null;
}

interface ColumnLabels {
  name: string;
  type: string;
  price: string;
  buyPrice: string;
  margin: string;
  unit: string;
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
}

export function buildProductFilterFields(
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
      render: (row) => (
        <span className="text-sm text-slate-700 dark:text-slate-300">
          {row.type === "RETAIL" && row.unitCost != null
            ? formatRupiah(row.unitCost)
            : "—"}
        </span>
      ),
    },
    {
      type: "custom",
      key: "margin",
      label: labels.margin,
      render: (row) => (
        <span className="text-sm text-slate-700 dark:text-slate-300">
          {row.type === "RETAIL" && row.margin != null
            ? formatRupiah(row.margin)
            : "—"}
        </span>
      ),
    },
    {
      type: "display",
      key: "unit",
      label: labels.unit,
      getValue: (row) => row.unit,
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
