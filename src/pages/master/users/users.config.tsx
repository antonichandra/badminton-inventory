import { CheckCircle2, Crown, Loader2, RotateCcw, Trash2, UserCog, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import type { FilterFieldConfig } from "../../../core/components/filters/types";
import type { SelectOption } from "../../../core/components/forms/types";
import type { TableColumnConfig, BadgeVariant } from "../../../core/components/table/types";
import { PlanBadge } from "../../../core/components/PlanBadge";
import { SportBadge } from "../../../core/components/SportBadge";
import { UserAvatar } from "../../../core/components/UserAvatar";
import { Badge } from "../../../core/components/table/Badge";
import { IconButton } from "../../../core/components/ui/IconButton";
import type { UserStatusKey } from "../../../core/i18n/statuses";
import { formatRoleName, roleBadgeVariant } from "../../../core/utils/formatRoleName";
import type { Id } from "../../../../convex/_generated/dataModel";

export interface MasterUserBusiness {
  businessId: Id<"businesses">;
  businessName: string;
  role: string;
  sportSlug: string;
  sportName: string;
  pendingInvitation: boolean;
}

export interface MasterUserRow {
  _id: Id<"users">;
  name: string;
  email: string;
  picture?: string;
  status: "PENDING" | "APPROVED" | "REVOKED";
  roleId: Id<"roles">;
  roleName: string;
  businesses: MasterUserBusiness[];
  planId: Id<"plans"> | null;
  planName: string | null;
  createdAt: number;
  updatedAt: number;
}

function canHavePlan(roleName: string): boolean {
  return roleName === "ADMIN" || roleName === "SUPER_ADMIN";
}

export function canEditUserAccess(
  row: MasterUserRow,
  currentUserId: Id<"users"> | undefined,
  isSuperAdmin: boolean,
): boolean {
  if (!currentUserId || row._id === currentUserId) {
    return false;
  }

  if (isSuperAdmin) {
    return row.roleName === "STAFF" || row.roleName === "ADMIN";
  }

  return row.roleName === "STAFF";
}

export function buildUsersFilterFields(
  labels: {
    search: string;
    searchPlaceholder: string;
    role: string;
    rolePlaceholder: string;
    business: string;
    businessPlaceholder: string;
    sport: string;
    sportPlaceholder: string;
    sportEmpty: string;
    status: string;
    statusPlaceholder: string;
    plan: string;
    planPlaceholder: string;
    roleEmpty: string;
    businessEmpty: string;
    planEmpty: string;
  },
  options?: {
    isSuperAdmin?: boolean;
    planOptions?: SelectOption[];
    statusOptions?: { value: UserStatusKey; label: string }[];
  },
): FilterFieldConfig[] {
  const fields: FilterFieldConfig[] = [
    {
      key: "search",
      type: "text",
      label: labels.search,
      placeholder: labels.searchPlaceholder,
      settings: {
        inputType: "search",
      },
    },
    {
      key: "roleIds",
      type: "multi-dropdown",
      label: labels.role,
      placeholder: labels.rolePlaceholder,
      settings: {
        searchPlaceholder: labels.role,
        optionSource: "roles",
        emptyMessage: labels.roleEmpty,
        maxDisplayTags: 2,
      },
    },
    {
      key: "statuses",
      type: "multi-dropdown",
      label: labels.status,
      placeholder: labels.statusPlaceholder,
      settings: {
        options: options?.statusOptions ?? [],
        maxDisplayTags: 2,
      },
    },
  ];

  if (options?.isSuperAdmin) {
    fields.push({
      key: "planFilterKeys",
      type: "multi-dropdown",
      label: labels.plan,
      placeholder: labels.planPlaceholder,
      settings: {
        searchPlaceholder: labels.plan,
        options: options.planOptions ?? [],
        emptyMessage: labels.planEmpty,
        maxDisplayTags: 2,
      },
    });
  }

  fields.push(
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
    {
      key: "businessIds",
      type: "multi-dropdown",
      label: labels.business,
      placeholder: labels.businessPlaceholder,
      settings: {
        searchable: true,
        searchPlaceholder: labels.business,
        optionSource: "businesses",
        emptyMessage: labels.businessEmpty,
        maxDisplayTags: 2,
      },
    },
  );

  return fields;
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

function statusVariant(status: MasterUserRow["status"]): BadgeVariant {
  if (status === "APPROVED") return "success";
  if (status === "REVOKED") return "danger";
  return "warning";
}

export function buildUsersTableColumns(
  labels: {
    name: string;
    role: string;
    status: string;
    plan: string;
    businesses: string;
    joined: string;
    noBusiness: string;
    noPlan: string;
    pendingInvite: string;
    actions: string;
    approveAdmin: string;
    approvePending: string;
    editPlan: string;
    editRole: string;
    revoke: string;
    resend: string;
    delete: string;
  },
  options: {
    isSuperAdmin: boolean;
    currentUserId?: Id<"users">;
    formatUserStatus: (status: MasterUserRow["status"]) => string;
    formatSportName: (slug: string, fallbackName?: string) => string;
  },
  actions?: {
    onApproveRequest: (row: MasterUserRow) => void;
    onEditPlan: (row: MasterUserRow) => void;
    onEditRole: (row: MasterUserRow) => void;
    onRequestRevoke: (row: MasterUserRow) => void;
    onRequestResend: (row: MasterUserRow) => void;
    onRequestDelete: (row: MasterUserRow) => void;
    actingUserId: Id<"users"> | null;
  },
): TableColumnConfig<MasterUserRow>[] {
  const columns: TableColumnConfig<MasterUserRow>[] = [
    {
      type: "custom",
      key: "name",
      label: labels.name,
      render: (row) => (
        <div className="flex items-center gap-3">
          <UserAvatar name={row.name} picture={row.picture} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
              {row.name}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {row.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      type: "custom",
      key: "role",
      label: labels.role,
      render: (row) => (
        <Badge variant={roleBadgeVariant(row.roleName)}>
          {formatRoleName(row.roleName)}
        </Badge>
      ),
    },
    {
      type: "badge",
      key: "status",
      label: labels.status,
      getValue: (row) => options.formatUserStatus(row.status),
      getVariant: (row) => statusVariant(row.status),
    },
  ];

  if (options.isSuperAdmin) {
    columns.push({
      type: "custom",
      key: "plan",
      label: labels.plan,
      render: (row) => {
        if (!canHavePlan(row.roleName)) {
          return <span className="text-sm text-slate-400">—</span>;
        }

        return (
          <PlanBadge planName={row.planName ?? labels.noPlan} />
        );
      },
    });
  }

  columns.push(
    {
      type: "custom",
      key: "businesses",
      label: labels.businesses,
      render: (row) => (
        <div className="flex max-w-xs flex-col gap-1.5">
          {row.businesses.length === 0 ? (
            <span className="text-sm text-slate-400">{labels.noBusiness}</span>
          ) : (
            row.businesses.map((business) => (
              <Link
                key={business.businessId}
                to={`/business/${business.businessId}/edit`}
                viewTransition
                className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30"
              >
                <SportBadge
                  slug={business.sportSlug}
                  name={options.formatSportName(
                    business.sportSlug,
                    business.sportName,
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                    {business.businessName}
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {options.formatSportName(
                      business.sportSlug,
                      business.sportName,
                    )}
                    {business.pendingInvitation && (
                      <span className="ml-1.5 text-amber-600 dark:text-amber-400">
                        · {labels.pendingInvite}
                      </span>
                    )}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      ),
    },
    {
      type: "display",
      key: "createdAt",
      label: labels.joined,
      getValue: (row) => formatDate(row.createdAt),
    },
    {
      type: "custom",
      key: "actions",
      label: labels.actions,
      headerClassName: "text-left",
      className: "text-left",
      render: (row) => {
        const canManage =
          Boolean(actions) &&
          canEditUserAccess(row, options.currentUserId, options.isSuperAdmin);
        const canApprove =
          options.isSuperAdmin &&
          row.status === "PENDING" &&
          row.roleName === "ADMIN";
        const canApprovePending =
          options.isSuperAdmin &&
          row.status === "PENDING" &&
          row.roleName === "PENDING" &&
          row._id !== options.currentUserId;
        const canEditPlan =
          options.isSuperAdmin && row.roleName === "ADMIN" && Boolean(actions);
        const showEditRole =
          canManage && row.status === "APPROVED";
        const showRevoke =
          canManage &&
          (row.status === "PENDING" || row.status === "APPROVED");
        const showResend = canManage && row.status === "REVOKED";
        const showDelete =
          canManage && row.status === "REVOKED" && row.roleName === "STAFF";
        const showDeletePending =
          options.isSuperAdmin &&
          row.status === "PENDING" &&
          row.roleName === "PENDING" &&
          row._id !== options.currentUserId;
        const isActing = actions?.actingUserId === row._id;

        if (
          !showEditRole &&
          !showRevoke &&
          !showResend &&
          !showDelete &&
          !showDeletePending &&
          !canEditPlan &&
          !canApprove &&
          !canApprovePending
        ) {
          return null;
        }

        return (
          <div className="flex justify-start gap-1">
            {showEditRole && actions && (
              <IconButton
                variant="default"
                tooltip={labels.editRole}
                tooltipPlacement="left"
                disabled={actions.actingUserId !== null}
                onClick={() => actions.onEditRole(row)}
                icon={<UserCog className="h-4 w-4" />}
              />
            )}
            {showRevoke && actions && (
              <IconButton
                variant="danger"
                tooltip={labels.revoke}
                tooltipPlacement="left"
                disabled={actions.actingUserId !== null}
                onClick={() => actions.onRequestRevoke(row)}
                icon={
                  isActing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )
                }
              />
            )}
            {canEditPlan && actions && (
              <IconButton
                variant="default"
                tooltip={labels.editPlan}
                tooltipPlacement="left"
                disabled={actions.actingUserId !== null}
                onClick={() => actions.onEditPlan(row)}
                icon={<Crown className="h-4 w-4" />}
              />
            )}
            {canApprove && actions && (
              <IconButton
                variant="success"
                tooltip={labels.approveAdmin}
                tooltipPlacement="left"
                disabled={actions.actingUserId !== null}
                onClick={() => actions.onApproveRequest(row)}
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
            )}
            {canApprovePending && actions && (
              <IconButton
                variant="success"
                tooltip={labels.approvePending}
                tooltipPlacement="left"
                disabled={actions.actingUserId !== null}
                onClick={() => actions.onApproveRequest(row)}
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
            )}
            {showResend && actions && (
              <IconButton
                variant="default"
                tooltip={labels.resend}
                tooltipPlacement="left"
                disabled={actions.actingUserId !== null}
                onClick={() => actions.onRequestResend(row)}
                icon={
                  isActing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )
                }
              />
            )}
            {showDelete && actions && (
              <IconButton
                variant="danger"
                tooltip={labels.delete}
                tooltipPlacement="left"
                disabled={actions.actingUserId !== null}
                onClick={() => actions.onRequestDelete(row)}
                icon={
                  isActing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )
                }
              />
            )}
            {showDeletePending && actions && (
              <IconButton
                variant="danger"
                tooltip={labels.delete}
                tooltipPlacement="left"
                disabled={actions.actingUserId !== null}
                onClick={() => actions.onRequestDelete(row)}
                icon={
                  isActing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )
                }
              />
            )}
          </div>
        );
      },
    },
  );

  return columns;
}
