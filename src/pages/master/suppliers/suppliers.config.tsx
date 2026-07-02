import { Check, Package, Pencil, Trash2 } from "lucide-react";
import type { FilterFieldConfig } from "../../../core/components/filters/types";
import { Badge } from "../../../core/components/table/Badge";
import type { TableColumnConfig } from "../../../core/components/table/types";
import { Button } from "../../../core/components/ui/Button";
import { IconButton } from "../../../core/components/ui/IconButton";
import type { Id } from "../../../../convex/_generated/dataModel";
import { formatDateOnly, type AppLanguage } from "../../../core/utils/formatDate";
import { formatRupiah } from "../../kasir/utils";

export type SupplierStatusFilter = "ACTIVE" | "INACTIVE";

export type SupplierReceiptPaymentFilter = "ALL" | "UNPAID" | "PAID";

export interface SupplierReceiptRow {
  _id: Id<"stockReceipts">;
  createdAt: number;
  supplierId: Id<"suppliers">;
  supplierName: string;
  totalAmount: number;
  dueAt?: number;
  supplierPaymentStatus: "UNPAID" | "PAID";
  paidAt?: number;
  shiftId: Id<"shifts">;
  itemCount: number;
  note?: string;
  canDelete?: boolean;
}

export interface SupplierRow {
  _id: Id<"suppliers">;
  name: string;
  description?: string;
  contact?: string;
  isActive: boolean;
  linkedProductCount?: number;
}

interface ColumnLabels {
  name: string;
  description: string;
  contact: string;
  products: string;
  productsAll: string;
  productsCount: string;
  status: string;
  active: string;
  inactive: string;
  edit: string;
  manageProducts: string;
}

interface FilterLabels {
  search: string;
  searchPlaceholder: string;
  status: string;
  statusPlaceholder: string;
  active: string;
  inactive: string;
}

export function buildSupplierFilterFields(
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
        maxDisplayTags: 2,
      },
    },
  ];
}

export function buildSupplierTableColumns(
  labels: ColumnLabels,
  onEdit: (row: SupplierRow) => void,
  onManageProducts: (row: SupplierRow) => void,
): TableColumnConfig<SupplierRow>[] {
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
      type: "display",
      key: "description",
      label: labels.description,
      getValue: (row) => row.description ?? "—",
    },
    {
      type: "display",
      key: "contact",
      label: labels.contact,
      getValue: (row) => row.contact ?? "—",
    },
    {
      type: "custom",
      key: "products",
      label: labels.products,
      render: (row) => (
        <span className="text-sm text-slate-700 dark:text-slate-300">
          {(row.linkedProductCount ?? 0) === 0
            ? labels.productsAll
            : labels.productsCount.replace(
                "{count}",
                String(row.linkedProductCount),
              )}
        </span>
      ),
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
            tooltip={labels.manageProducts}
            tooltipPlacement="left"
            onClick={() => onManageProducts(row)}
            icon={<Package className="h-4 w-4" />}
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

interface ReceiptColumnLabels {
  date: string;
  supplier: string;
  total: string;
  due: string;
  status: string;
  unpaid: string;
  paid: string;
  overdue: string;
  markPaid: string;
  detail: string;
  delete: string;
}

export function buildSupplierReceiptTableColumns(
  labels: ReceiptColumnLabels,
  language: AppLanguage,
  onMarkPaid: (row: SupplierReceiptRow) => void,
  onViewDetail: (row: SupplierReceiptRow) => void,
  onDelete: (row: SupplierReceiptRow) => void,
  markingId: Id<"stockReceipts"> | null,
  deletingId: Id<"stockReceipts"> | null,
): TableColumnConfig<SupplierReceiptRow>[] {
  const now = Date.now();

  return [
    {
      type: "display",
      key: "createdAt",
      label: labels.date,
      getValue: (row) => formatDateOnly(row.createdAt, language),
    },
    {
      type: "display",
      key: "supplierName",
      label: labels.supplier,
      getValue: (row) => row.supplierName,
    },
    {
      type: "display",
      key: "totalAmount",
      label: labels.total,
      getValue: (row) => formatRupiah(row.totalAmount),
    },
    {
      type: "custom",
      key: "dueAt",
      label: labels.due,
      render: (row) => {
        if (!row.dueAt) {
          return <span className="text-sm text-slate-500">—</span>;
        }
        const overdue =
          row.supplierPaymentStatus === "UNPAID" && row.dueAt < now;
        return (
          <div className="flex flex-col gap-1">
            <span className="text-sm text-slate-900 dark:text-white">
              {formatDateOnly(row.dueAt, language)}
            </span>
            {overdue && (
              <Badge variant="danger">
                {labels.overdue}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      type: "badge",
      key: "supplierPaymentStatus",
      label: labels.status,
      getValue: (row) =>
        row.supplierPaymentStatus === "PAID" ? labels.paid : labels.unpaid,
      getVariant: (row) =>
        row.supplierPaymentStatus === "PAID" ? "success" : "warning",
    },
    {
      type: "custom",
      key: "actions",
      label: "",
      headerClassName: "text-right",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => onViewDetail(row)}>
            {labels.detail}
          </Button>
          {row.supplierPaymentStatus === "UNPAID" ? (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Check className="h-3.5 w-3.5" />}
              loading={markingId === row._id}
              disabled={markingId !== null || deletingId !== null}
              onClick={() => onMarkPaid(row)}
            >
              {labels.markPaid}
            </Button>
          ) : null}
          {row.canDelete !== false ? (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              loading={deletingId === row._id}
              disabled={markingId !== null || deletingId !== null}
              onClick={() => onDelete(row)}
            >
              {labels.delete}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];
}
