import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader } from "../../core/components/PageHeader";
import { PermissionGuard } from "../../core/components/PermissionGuard";
import { Button } from "../../core/components/ui/Button";
import { ConfirmModal } from "../../core/components/ui/ConfirmModal";
import { Skeleton } from "../../core/components/ui/Skeleton";
import { useAuth } from "../../core/context/AuthContext";
import { useLanguage } from "../../core/context/LanguageContext";
import { useToast } from "../../core/context/ToastContext";
import { mapSportSelectOptions } from "../../core/i18n/sports";
import { translateStaffStatus } from "../../core/i18n/statuses";
import { navigateWithTransition } from "../../core/utils/viewTransition";
import { EditUserRoleModal } from "../master/users/EditUserRoleModal";
import { BusinessFormFields, validateBusinessForm, type BusinessFormErrors, type BusinessFormValues } from "./components/BusinessFormFields";
import { StaffInvitationTable, type StaffInvitationRow } from "./components/StaffInvitationTable";
import { toStaffDisplayStatus } from "./staffStatus";

const EMPTY_VALUES: BusinessFormValues = {
  name: "",
  sportId: "",
  phone: "",
  address: "",
};

export function BusinessFormPage() {
  const { translate } = useLanguage();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { businessId } = useParams();
  const { sessionToken, acl, user } = useAuth();
  const isSuperAdmin = acl.includes("master_business");
  const isEditMode = Boolean(businessId);

  const [values, setValues] = useState<BusinessFormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<BusinessFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [actingInvitationId, setActingInvitationId] =
    useState<Id<"staffInvitations"> | null>(null);
  const [invitationToRevoke, setInvitationToRevoke] =
    useState<StaffInvitationRow | null>(null);
  const [invitationToResend, setInvitationToResend] =
    useState<StaffInvitationRow | null>(null);
  const [invitationToDelete, setInvitationToDelete] =
    useState<StaffInvitationRow | null>(null);
  const [staffToEditRole, setStaffToEditRole] =
    useState<StaffInvitationRow | null>(null);
  const [roleConfirmState, setRoleConfirmState] = useState<{
    staff: StaffInvitationRow;
    roleId: Id<"roles">;
    roleLabel: string;
  } | null>(null);
  const [isSavingRole, setIsSavingRole] = useState(false);

  const sportOptions = useQuery(api.sports.listSports);
  const business = useQuery(
    api.businesses.getBusiness,
    sessionToken && businessId
      ? { sessionToken, businessId: businessId as Id<"businesses"> }
      : "skip",
  );
  const invitations = useQuery(
    api.staffInvitations.listByBusiness,
    sessionToken && businessId
      ? { sessionToken, businessId: businessId as Id<"businesses"> }
      : "skip",
  );
  const staffQuota = useQuery(
    api.staffInvitations.getStaffQuotaForBusiness,
    sessionToken && businessId
      ? { sessionToken, businessId: businessId as Id<"businesses"> }
      : "skip",
  );

  const createBusiness = useMutation(api.businesses.createBusiness);
  const updateBusiness = useMutation(api.businesses.updateBusiness);
  const inviteStaff = useMutation(api.staffInvitations.inviteStaff);
  const revokeInvitation = useMutation(api.staffInvitations.revokeInvitation);
  const resendInvitation = useMutation(api.staffInvitations.resendInvitation);
  const deleteStaffAccount = useMutation(api.staffInvitations.deleteStaffAccount);
  const updateUserAccess = useMutation(api.users.updateUserAccess);

  const editableRoleOptions = useQuery(
    api.users.listEditableRoleOptions,
    sessionToken && staffToEditRole?.userId
      ? { sessionToken, targetUserId: staffToEditRole.userId }
      : "skip",
  );

  useEffect(() => {
    if (!business) return;
    setValues({
      name: business.name,
      sportId: business.sportId,
      phone: business.phone ?? "",
      address: business.address,
    });
  }, [business]);

  const formLabels = useMemo(
    () => ({
      name: translate("businessFieldName"),
      namePlaceholder: translate("businessFieldNamePlaceholder"),
      sport: translate("businessFieldSport"),
      sportPlaceholder: translate("businessFieldSportPlaceholder"),
      phone: translate("businessFieldPhone"),
      phonePlaceholder: translate("businessFieldPhonePlaceholder"),
      address: translate("businessFieldAddress"),
      addressPlaceholder: translate("businessFieldAddressPlaceholder"),
    }),
    [translate],
  );

  const translatedSportOptions = useMemo(
    () => mapSportSelectOptions(sportOptions ?? [], translate),
    [sportOptions, translate],
  );

  const handleValuesChange = (next: BusinessFormValues) => {
    setValues(next);
    setFieldErrors((prev) => {
      const cleared = { ...prev };
      if (next.name.trim()) delete cleared.name;
      if (next.sportId) delete cleared.sportId;
      if (next.address.trim()) delete cleared.address;
      return cleared;
    });
  };

  const handleSave = async () => {
    if (!sessionToken) return;

    const validationErrors = validateBusinessForm(
      values,
      translate("validationRequired"),
    );
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setIsSaving(true);

    try {
      if (isEditMode && businessId) {
        await updateBusiness({
          sessionToken,
          businessId: businessId as Id<"businesses">,
          name: values.name,
          sportId: values.sportId as Id<"sports">,
          phone: values.phone || undefined,
          address: values.address,
        });
        showToast({
          type: "success",
          message: translate("businessUpdateSuccess"),
        });
      } else {
        await createBusiness({
          sessionToken,
          name: values.name,
          sportId: values.sportId as Id<"sports">,
          phone: values.phone || undefined,
          address: values.address,
        });
        await navigateWithTransition(navigate, "/business");
        return;
      }
    } catch (error) {
      const message = String(error);
      showToast({
        type: "error",
        message: message.includes("BUSINESS_LIMIT_REACHED")
          ? translate("businessLimitReached")
          : isEditMode
            ? translate("businessUpdateError")
            : translate("businessCreateError"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleInvite = async (email: string) => {
    if (!sessionToken || !businessId) return;

    setIsInviting(true);

    try {
      await inviteStaff({
        sessionToken,
        businessId: businessId as Id<"businesses">,
        email,
      });
      showToast({
        type: "success",
        message: translate("businessStaffInviteSuccess"),
      });
    } catch (error) {
      const message = String(error);
      showToast({
        type: "error",
        message: message.includes("STAFF_LIMIT_REACHED")
          ? translate("businessStaffLimitReached")
          : message.includes("STAFF_ALREADY_ASSIGNED")
            ? translate("businessStaffAlreadyAssigned")
            : translate("businessStaffInviteError"),
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!sessionToken || !invitationToRevoke) return;

    setActingInvitationId(invitationToRevoke._id);

    try {
      await revokeInvitation({
        sessionToken,
        invitationId: invitationToRevoke._id,
      });
      setInvitationToRevoke(null);
      showToast({
        type: "success",
        message: translate("businessStaffRevokeSuccess"),
      });
    } catch {
      showToast({
        type: "error",
        message: translate("businessStaffActionError"),
      });
    } finally {
      setActingInvitationId(null);
    }
  };

  const handleConfirmResend = async () => {
    if (!sessionToken || !invitationToResend) return;

    setActingInvitationId(invitationToResend._id);

    try {
      await resendInvitation({
        sessionToken,
        invitationId: invitationToResend._id,
      });
      setInvitationToResend(null);
      showToast({
        type: "success",
        message: translate("businessStaffResendSuccess"),
      });
    } catch (error) {
      const message = String(error);
      showToast({
        type: "error",
        message: message.includes("STAFF_LIMIT_REACHED")
          ? translate("businessStaffLimitReached")
          : translate("businessStaffActionError"),
      });
    } finally {
      setActingInvitationId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!sessionToken || !invitationToDelete) return;

    setActingInvitationId(invitationToDelete._id);

    try {
      await deleteStaffAccount({
        sessionToken,
        invitationId: invitationToDelete._id,
      });
      setInvitationToDelete(null);
      showToast({
        type: "success",
        message: translate("businessStaffDeleteSuccess"),
      });
    } catch (error) {
      const message = String(error);
      showToast({
        type: "error",
        message: message.includes("CANNOT_DELETE_SELF")
          ? translate("usersEditAccessSelf")
          : message.includes("CANNOT_DELETE_NON_STAFF")
            ? translate("businessStaffDeleteNonStaff")
            : message.includes("INVITATION_NOT_DELETABLE")
              ? translate("businessStaffDeleteNotRevoked")
              : translate("businessStaffActionError"),
      });
    } finally {
      setActingInvitationId(null);
    }
  };

  const handleRequestSaveRole = useCallback(
    (roleId: Id<"roles">) => {
      if (!staffToEditRole) return;

      const roleLabel =
        editableRoleOptions?.find((role) => role.value === roleId)?.label ??
        "";

      setRoleConfirmState({
        staff: staffToEditRole,
        roleId,
        roleLabel,
      });
      setStaffToEditRole(null);
    },
    [editableRoleOptions, staffToEditRole],
  );

  const handleConfirmSaveRole = useCallback(async () => {
    if (!roleConfirmState?.staff.userId || !sessionToken) return;

    const currentStatus = roleConfirmState.staff.userStatus ?? "APPROVED";

    setIsSavingRole(true);

    try {
      await updateUserAccess({
        sessionToken,
        userId: roleConfirmState.staff.userId,
        status: currentStatus,
        roleId: roleConfirmState.roleId,
      });
      setRoleConfirmState(null);
      showToast({
        type: "success",
        message: translate("businessStaffEditRoleSuccess"),
      });
    } catch (error) {
      const message = String(error);
      showToast({
        type: "error",
        message:
          message.includes("CANNOT_EDIT_SELF") ||
          message.includes("FORBIDDEN") ||
          message.includes("TARGET_OUT_OF_SCOPE")
            ? translate("usersEditAccessForbidden")
            : translate("businessStaffEditRoleError"),
      });
    } finally {
      setIsSavingRole(false);
    }
  }, [
    roleConfirmState,
    sessionToken,
    showToast,
    translate,
    updateUserAccess,
  ]);

  const isLoading =
    sportOptions === undefined ||
    (isEditMode &&
      (business === undefined ||
        invitations === undefined ||
        staffQuota === undefined));

  return (
    <PermissionGuard permission="business">
      <PageHeader
        title={translate(
          isEditMode ? "pageBusinessEditTitle" : "pageBusinessAddTitle",
        )}
        subtitle={translate(
          isEditMode ? "pageBusinessEditSubtitle" : "pageBusinessAddSubtitle",
        )}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        {isLoading ? (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <BusinessFormFields
              values={values}
              errors={fieldErrors}
              onChange={handleValuesChange}
              sportOptions={translatedSportOptions}
              labels={formLabels}
              disabled={isSaving}
            />

            <div className="mt-6 flex justify-end">
              <Button onClick={() => void handleSave()} loading={isSaving}>
                {translate("businessSave")}
              </Button>
            </div>
          </>
        )}
      </div>

      {isEditMode && businessId && !isLoading && staffQuota && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <StaffInvitationTable
            invitations={invitations ?? []}
            staffCount={staffQuota.staffCount}
            maxStaff={staffQuota.maxStaff}
            isLoading={invitations === undefined}
            isSubmitting={isInviting}
            actingInvitationId={actingInvitationId}
            currentUserId={user?._id}
            isSuperAdmin={isSuperAdmin}
            labels={{
              title: translate("businessStaffInvitations"),
              email: translate("businessStaffEmail"),
              role: translate("businessStaffRole"),
              status: translate("usersColStatus"),
              actions: translate("businessColActions"),
              invitePlaceholder: translate("businessStaffInvitePlaceholder"),
              inviteButton: translate("businessStaffInvite"),
              roleStaff: translate("businessStaffRoleStaff"),
              revoke: translate("businessStaffRevoke"),
              resend: translate("businessStaffResend"),
              delete: translate("businessStaffDelete"),
              editRole: translate("businessStaffEditRole"),
              empty: translate("placeholderEmpty"),
              staffQuota: translate("businessStaffQuota"),
              limitReached: translate("businessStaffLimitReached"),
              formatStaffStatus: (status) =>
                translateStaffStatus(translate, status),
            }}
            onInvite={handleInvite}
            onRequestRevoke={setInvitationToRevoke}
            onRequestResend={setInvitationToResend}
            onRequestDelete={setInvitationToDelete}
            onEditRole={setStaffToEditRole}
          />
        </div>
      )}

      <ConfirmModal
        open={invitationToRevoke !== null}
        onClose={() => {
          if (actingInvitationId === null) {
            setInvitationToRevoke(null);
          }
        }}
        onConfirm={() => void handleConfirmRevoke()}
        title={translate("businessStaffRevokeConfirmTitle")}
        description={
          invitationToRevoke
            ? translate("businessStaffRevokeConfirmDesc")
                .replace("{email}", invitationToRevoke.email)
                .replace(
                  "{status}",
                  translateStaffStatus(
                    translate,
                    toStaffDisplayStatus(invitationToRevoke.status),
                  ),
                )
                .replace(
                  "{nextStatus}",
                  translateStaffStatus(translate, "REVOKED"),
                )
            : undefined
        }
        confirmLabel={translate("businessStaffRevoke")}
        cancelLabel={translate("cancel")}
        confirmVariant="danger"
        loading={actingInvitationId !== null}
      />

      <ConfirmModal
        open={invitationToResend !== null}
        onClose={() => {
          if (actingInvitationId === null) {
            setInvitationToResend(null);
          }
        }}
        onConfirm={() => void handleConfirmResend()}
        title={translate("businessStaffResendConfirmTitle")}
        description={
          invitationToResend
            ? translate("businessStaffResendConfirmDesc")
                .replace("{email}", invitationToResend.email)
                .replace(
                  "{status}",
                  translateStaffStatus(translate, "REVOKED"),
                )
                .replace(
                  "{nextStatus}",
                  translateStaffStatus(translate, "PENDING"),
                )
            : undefined
        }
        confirmLabel={translate("businessStaffResend")}
        cancelLabel={translate("cancel")}
        loading={actingInvitationId !== null}
      />

      <ConfirmModal
        open={invitationToDelete !== null}
        onClose={() => {
          if (actingInvitationId === null) {
            setInvitationToDelete(null);
          }
        }}
        onConfirm={() => void handleConfirmDelete()}
        title={translate("businessStaffDeleteConfirmTitle")}
        description={
          invitationToDelete
            ? translate("businessStaffDeleteConfirmDesc").replace(
                "{email}",
                invitationToDelete.email,
              )
            : undefined
        }
        confirmLabel={translate("businessStaffDelete")}
        cancelLabel={translate("cancel")}
        confirmVariant="danger"
        loading={actingInvitationId !== null}
      />

      <EditUserRoleModal
        open={staffToEditRole !== null}
        userName={staffToEditRole?.userName ?? staffToEditRole?.email ?? ""}
        currentRoleId={staffToEditRole?.roleId ?? ("" as Id<"roles">)}
        roleOptions={editableRoleOptions ?? []}
        isSaving={isSavingRole}
        labels={{
          title: translate("businessStaffEditRoleTitle"),
          description: translate("businessStaffEditRoleDesc"),
          role: translate("businessStaffRole"),
          rolePlaceholder: translate("usersEditAccessRolePlaceholder"),
          roleEmpty: translate("usersFilterRoleEmpty"),
          save: translate("businessStaffEditRoleSave"),
          cancel: translate("cancel"),
        }}
        onClose={() => {
          if (!isSavingRole) {
            setStaffToEditRole(null);
          }
        }}
        onSave={handleRequestSaveRole}
      />

      <ConfirmModal
        open={roleConfirmState !== null}
        onClose={() => {
          if (!isSavingRole) {
            setRoleConfirmState(null);
          }
        }}
        onConfirm={() => void handleConfirmSaveRole()}
        title={translate("businessStaffEditRoleConfirmTitle")}
        description={
          roleConfirmState
            ? translate("businessStaffEditRoleConfirmDesc")
                .replace(
                  "{name}",
                  roleConfirmState.staff.userName ?? roleConfirmState.staff.email,
                )
                .replace("{role}", roleConfirmState.roleLabel)
            : undefined
        }
        confirmLabel={translate("businessStaffEditRoleSave")}
        cancelLabel={translate("cancel")}
        loading={isSavingRole}
      />
    </PermissionGuard>
  );
}
