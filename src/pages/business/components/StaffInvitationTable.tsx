import { useState } from "react";
import { Loader2, RotateCcw, Trash2, UserCog, XCircle } from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { DataTable } from "../../../core/components/table/DataTable";
import type { TableColumnConfig } from "../../../core/components/table/types";
import { InputText } from "../../../core/components/forms/InputText";
import { Button } from "../../../core/components/ui/Button";
import { IconButton } from "../../../core/components/ui/IconButton";
import { Badge } from "../../../core/components/table/Badge";
import { cn } from "../../../core/utils/cn";
import { formatRoleName, roleBadgeVariant } from "../../../core/utils/formatRoleName";
import type { StaffDisplayStatusKey } from "../../../core/i18n/statuses";
import { canEditUserAccess } from "../../master/users/users.config";
import {
  toStaffDisplayStatus,
  type StaffDisplayStatus,
  type StaffInvitationStatus,
} from "../staffStatus";

export interface StaffInvitationRow {
  _id: Id<"staffInvitations">;
  email: string;
  status: StaffInvitationStatus;
  createdAt: number;
  userId?: Id<"users">;
  userName?: string;
  userStatus?: "PENDING" | "APPROVED" | "REVOKED";
  roleId?: Id<"roles">;
  roleName?: string;
}

interface StaffInvitationTableProps {
  invitations: StaffInvitationRow[];
  staffCount: number;
  maxStaff: number;
  isLoading?: boolean;
  isSubmitting?: boolean;
  actingInvitationId?: Id<"staffInvitations"> | null;
  currentUserId?: Id<"users">;
  isSuperAdmin?: boolean;
  labels: {
    title: string;
    email: string;
    role: string;
    status: string;
    actions: string;
    invitePlaceholder: string;
    inviteButton: string;
    roleStaff: string;
    revoke: string;
    resend: string;
    delete: string;
    editRole: string;
    loading: string;
    empty: string;
    staffQuota: string;
    limitReached: string;
    formatStaffStatus: (status: StaffDisplayStatusKey) => string;
  };
  onInvite: (email: string) => Promise<void>;
  onRequestRevoke: (invitation: StaffInvitationRow) => void;
  onRequestResend: (invitation: StaffInvitationRow) => void;
  onRequestDelete: (invitation: StaffInvitationRow) => void;
  onEditRole: (invitation: StaffInvitationRow) => void;
}

function statusVariant(
  status: StaffDisplayStatus,
): "warning" | "success" | "default" | "danger" {
  if (status === "PENDING") return "warning";
  if (status === "APPROVED") return "success";
  if (status === "REVOKED") return "danger";
  return "default";
}

function canEditStaffRole(
  row: StaffInvitationRow,
  currentUserId: Id<"users"> | undefined,
  isSuperAdmin: boolean,
): boolean {
  if (
    row.status !== "ACCEPTED" ||
    !row.userId ||
    !row.roleId ||
    !row.userStatus ||
    !row.roleName
  ) {
    return false;
  }

  return canEditUserAccess(
    {
      _id: row.userId,
      name: row.userName ?? row.email,
      email: row.email,
      status: row.userStatus,
      roleId: row.roleId,
      roleName: row.roleName,
      businesses: [],
      planId: null,
      planName: null,
      createdAt: row.createdAt,
      updatedAt: row.createdAt,
    },
    currentUserId,
    isSuperAdmin,
  );
}

export function StaffInvitationTable({
  invitations,
  staffCount,
  maxStaff,
  isLoading = false,
  isSubmitting = false,
  actingInvitationId = null,
  currentUserId,
  isSuperAdmin = false,
  labels,
  onInvite,
  onRequestRevoke,
  onRequestResend,
  onRequestDelete,
  onEditRole,
}: StaffInvitationTableProps) {
  const [email, setEmail] = useState("");
  const isAtLimit = staffCount >= maxStaff;
  const isEmailEmpty = !email.trim();
  const canInvite = !isAtLimit && !isEmailEmpty;

  const columns: TableColumnConfig<StaffInvitationRow>[] = [
    {
      type: "display",
      key: "email",
      label: labels.email,
      getValue: (row) => row.email,
    },
    {
      type: "custom",
      key: "role",
      label: labels.role,
      render: (row) => {
        const roleName = row.roleName ?? "STAFF";
        const roleLabel =
          roleName === "STAFF" ? labels.roleStaff : formatRoleName(roleName);

        return (
          <Badge variant={roleBadgeVariant(roleName)}>{roleLabel}</Badge>
        );
      },
    },
    {
      type: "badge",
      key: "status",
      label: labels.status,
      getValue: (row) =>
        labels.formatStaffStatus(toStaffDisplayStatus(row.status)),
      getVariant: (row) => statusVariant(toStaffDisplayStatus(row.status)),
    },
    {
      type: "custom",
      key: "actions",
      label: labels.actions,
      headerClassName: "text-left",
      className: "text-left",
      render: (row) => {
        const isActing = actingInvitationId === row._id;
        const showEditRole = canEditStaffRole(
          row,
          currentUserId,
          isSuperAdmin,
        );
        const showRevoke =
          row.status === "PENDING" || row.status === "ACCEPTED";
        const showResend = row.status === "REVOKED";
        const showDelete = row.status === "REVOKED";

        if (!showEditRole && !showRevoke && !showResend && !showDelete) {
          return null;
        }

        return (
          <div className="flex justify-start gap-1">
            {showEditRole && (
              <IconButton
                variant="default"
                tooltip={labels.editRole}
                tooltipPlacement="left"
                disabled={actingInvitationId !== null}
                onClick={() => onEditRole(row)}
                icon={<UserCog className="h-4 w-4" />}
              />
            )}
            {showRevoke && (
              <IconButton
                variant="danger"
                tooltip={labels.revoke}
                tooltipPlacement="left"
                disabled={actingInvitationId !== null}
                onClick={() => onRequestRevoke(row)}
                icon={
                  isActing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )
                }
              />
            )}
            {showResend && (
              <IconButton
                variant="default"
                tooltip={labels.resend}
                tooltipPlacement="left"
                disabled={actingInvitationId !== null}
                onClick={() => onRequestResend(row)}
                icon={
                  isActing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )
                }
              />
            )}
            {showDelete && (
              <IconButton
                variant="danger"
                tooltip={labels.delete}
                tooltipPlacement="left"
                disabled={actingInvitationId !== null}
                onClick={() => onRequestDelete(row)}
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
  ];

  const handleInvite = async () => {
    const trimmed = email.trim();
    if (!trimmed || isAtLimit) return;
    await onInvite(trimmed);
    setEmail("");
  };

  const quotaText = labels.staffQuota
    .replace("{current}", String(staffCount))
    .replace("{max}", String(maxStaff));

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          {labels.title}
        </h3>
        <span
          className={cn(
            "inline-flex w-fit rounded-lg border px-3 py-1.5 text-sm",
            isAtLimit
              ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
              : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
          )}
        >
          {quotaText}
        </span>
      </div>

      {isAtLimit && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          {labels.limitReached}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <InputText
            label={labels.email}
            placeholder={labels.invitePlaceholder}
            value={email}
            onChange={setEmail}
            disabled={isSubmitting || isAtLimit}
          />
        </div>
        <Button
          onClick={() => void handleInvite()}
          loading={isSubmitting}
          disabled={!canInvite}
          className="sm:mb-0.5"
        >
          {labels.inviteButton}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={invitations}
        getRowKey={(row) => row._id}
        isLoading={isLoading}
        loadingMessage={labels.loading}
        emptyMessage={labels.empty}
      />
    </>
  );
}
