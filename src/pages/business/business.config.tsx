import { CheckCircle2, Pencil, RotateCcw, Star, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { FilterFieldConfig } from "../../core/components/filters/types";
import type { TableColumnConfig, BadgeVariant } from "../../core/components/table/types";
import { SportBadge } from "../../core/components/SportBadge";
import { IconButton } from "../../core/components/ui/IconButton";
import type { Id } from "../../../convex/_generated/dataModel";

export interface BusinessRow {
  _id: Id<"businesses">;
  name: string;
  sportId: Id<"sports">;
  sportSlug: string;
  sportName: string;
  phone?: string;
  address: string;
  ownerId: Id<"users">;
  ownerName: string;
  ownerEmail: string;
  status: "ACTIVE" | "DELETE_REQUESTED";
  isActive: boolean;
  isDefault: boolean;
  createdAt: number;
}

function statusVariant(status: BusinessRow["status"]): BadgeVariant {
  return status === "ACTIVE" ? "success" : "warning";
}

export function buildBusinessFilterFields(
  labels: {
    search: string;
    searchPlaceholder: string;
    owner: string;
    ownerPlaceholder: string;
    sport: string;
    sportPlaceholder: string;
    sportEmpty: string;
    status: string;
    statusPlaceholder: string;
  },
  options: {
    showOwnerFilter: boolean;
    statusOptions?: { value: BusinessRow["status"]; label: string }[];
  },
): FilterFieldConfig[] {
  const fields: FilterFieldConfig[] = [
    {
      key: "search",
      type: "text",
      label: labels.search,
      placeholder: labels.searchPlaceholder,
      settings: { inputType: "search" },
    },
    {
      key: "sportIds",
      type: "multi-dropdown",
      label: labels.sport,
      placeholder: labels.sportPlaceholder,
      settings: {
        searchPlaceholder: labels.sport,
        optionSource: "sports",
        emptyMessage: labels.sportEmpty,
        maxDisplayTags: 2,
      },
    },
  ];

  if (options.showOwnerFilter) {
    fields.push({
      key: "ownerSearch",
      type: "text",
      label: labels.owner,
      placeholder: labels.ownerPlaceholder,
      settings: { inputType: "search" },
    });
  }

  fields.push({
    key: "statuses",
    type: "multi-dropdown",
    label: labels.status,
    placeholder: labels.statusPlaceholder,
    settings: {
      options: options.statusOptions ?? [],
      maxDisplayTags: 2,
    },
  });

  return fields;
}

export function buildBusinessTableColumns(
  labels: {
    name: string;
    sport: string;
    phone: string;
    address: string;
    owner: string;
    status: string;
    statusActive: string;
    statusDeleteRequested: string;
    actions: string;
    edit: string;
    setDefault: string;
    requestDelete: string;
    approveDelete: string;
    cancelDelete: string;
    noPhone: string;
  },
  options: {
    showOwnerColumn: boolean;
    isSuperAdmin: boolean;
    formatSportName: (slug: string, fallbackName?: string) => string;
  },
  actions?: {
    onSetDefault: (row: BusinessRow) => void;
    onRequestDelete: (row: BusinessRow) => void;
    onCancelDelete: (row: BusinessRow) => void;
    onApproveDelete: (row: BusinessRow) => void;
    actingBusinessId: Id<"businesses"> | null;
  },
): TableColumnConfig<BusinessRow>[] {
  const columns: TableColumnConfig<BusinessRow>[] = [
    {
      type: "custom",
      key: "name",
      label: labels.name,
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {row.name}
          </p>
          {row.isDefault && !options.isSuperAdmin && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Default
            </p>
          )}
        </div>
      ),
    },
    {
      type: "custom",
      key: "sport",
      label: labels.sport,
      render: (row) => {
        const sportLabel = options.formatSportName(row.sportSlug, row.sportName);

        return (
          <div className="flex items-center gap-2">
            <SportBadge slug={row.sportSlug} name={sportLabel} />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {sportLabel}
            </span>
          </div>
        );
      },
    },
    {
      type: "display",
      key: "phone",
      label: labels.phone,
      getValue: (row) => row.phone || labels.noPhone,
    },
    {
      type: "display",
      key: "address",
      label: labels.address,
      getValue: (row) => row.address,
    },
    {
      type: "badge",
      key: "status",
      label: labels.status,
      getValue: (row) =>
        row.status === "ACTIVE"
          ? labels.statusActive
          : labels.statusDeleteRequested,
      getVariant: (row) => statusVariant(row.status),
    },
  ];

  if (options.showOwnerColumn) {
    columns.splice(4, 0, {
      type: "custom",
      key: "owner",
      label: labels.owner,
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {row.ownerName}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {row.ownerEmail}
          </p>
        </div>
      ),
    });
  }

  columns.push({
    type: "custom",
    key: "actions",
    label: labels.actions,
    headerClassName: "text-right",
    className: "text-right",
    render: (row) => {
      const canEdit = row.status === "ACTIVE";
      const canSetDefault =
        !options.isSuperAdmin && canEdit && !row.isDefault && actions;
      const canRequestDelete =
        !options.isSuperAdmin && canEdit && actions;
      const canCancelDelete =
        !options.isSuperAdmin &&
        row.status === "DELETE_REQUESTED" &&
        actions;
      const canApproveDelete =
        options.isSuperAdmin && row.status === "DELETE_REQUESTED" && actions;

      return (
        <div className="flex justify-end gap-1">
          {canSetDefault && (
            <IconButton
              variant="default"
              tooltip={labels.setDefault}
              tooltipPlacement="left"
              disabled={actions.actingBusinessId !== null}
              onClick={() => actions.onSetDefault(row)}
              icon={<Star className="h-4 w-4" />}
            />
          )}

          {canEdit && (
            <Link to={`/business/${row._id}/edit`} viewTransition>
              <IconButton
                variant="default"
                tooltip={labels.edit}
                tooltipPlacement="left"
                icon={<Pencil className="h-4 w-4" />}
              />
            </Link>
          )}


          {canRequestDelete && (
            <IconButton
              variant="danger"
              tooltip={labels.requestDelete}
              tooltipPlacement="left"
              disabled={actions.actingBusinessId !== null}
              onClick={() => actions.onRequestDelete(row)}
              icon={<Trash2 className="h-4 w-4" />}
            />
          )}

          {canCancelDelete && (
            <IconButton
              variant="default"
              tooltip={labels.cancelDelete}
              tooltipPlacement="left"
              disabled={actions.actingBusinessId !== null}
              onClick={() => actions.onCancelDelete(row)}
              icon={<RotateCcw className="h-4 w-4" />}
            />
          )}

          {canApproveDelete && (
            <IconButton
              variant="success"
              tooltip={labels.approveDelete}
              tooltipPlacement="left"
              disabled={actions.actingBusinessId !== null}
              onClick={() => actions.onApproveDelete(row)}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
          )}
        </div>
      );
    },
  });

  return columns;
}
