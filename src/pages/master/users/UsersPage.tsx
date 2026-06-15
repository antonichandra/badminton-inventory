import { type CredentialResponse } from "@react-oauth/google";
import { useCallback, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { AdminListStats } from "../../../core/components/AdminListStats";
import { GoogleSignInButton } from "../../../core/components/GoogleSignInButton";
import { PageHeader } from "../../../core/components/PageHeader";
import { PageTopSection } from "../../../core/components/PageTopSection";
import { PermissionGuard } from "../../../core/components/PermissionGuard";
import { ResponsiveFilterBar } from "../../../core/components/filters/ResponsiveFilterBar";
import { DataTable } from "../../../core/components/table/DataTable";
import { ConfirmModal } from "../../../core/components/ui/ConfirmModal";
import { useAuth } from "../../../core/context/AuthContext";
import { useToast } from "../../../core/context/ToastContext";
import { useFilterState } from "../../../core/hooks/useFilterState";
import { useLanguage } from "../../../core/context/LanguageContext";
import type { TranslationKey } from "../../../core/i18n";
import {
  mapSportSelectOptions,
  translateSportName,
} from "../../../core/i18n/sports";
import {
  buildUserStatusOptions,
  translateUserStatus,
} from "../../../core/i18n/statuses";
import { EditUserPlanModal } from "./EditUserPlanModal";
import { EditUserRoleModal } from "./EditUserRoleModal";
import {
  buildUsersFilterFields,
  buildUsersTableColumns,
  type MasterUserRow,
} from "./users.config";

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "";
}

function getRegisterAdminErrorMessage(
  error: unknown,
  translate: (key: TranslationKey) => string,
): string {
  const message = getErrorText(error);

  if (message.includes("USER_ALREADY_APPROVED")) {
    return translate("usersRegisterPendingAdminAlreadyApproved");
  }
  if (message.includes("CANNOT_REGISTER_SELF")) {
    return translate("usersRegisterPendingAdminSelf");
  }
  if (message.includes("FORBIDDEN")) {
    return translate("usersRegisterPendingAdminForbidden");
  }
  if (message.includes("UNAUTHORIZED")) {
    return translate("usersRegisterPendingAdminUnauthorized");
  }

  console.error("Register pending admin failed:", error);
  return translate("usersRegisterPendingAdminError");
}

export function UsersPage() {
  const { translate } = useLanguage();
  const { showToast } = useToast();
  const { sessionToken, acl, user } = useAuth();
  const isSuperAdmin = acl.includes("master_business");

  const registerPendingAdmin = useAction(
    api.usersActions.registerPendingAdminWithGoogle,
  );
  const approvePendingAdmin = useMutation(api.users.approvePendingAdmin);
  const approvePendingUser = useMutation(api.users.approvePendingUser);
  const assignPlanToUser = useMutation(api.plans.assignPlanToUser);
  const updateUserAccess = useMutation(api.users.updateUserAccess);
  const revokeUser = useMutation(api.users.revokeUser);
  const resendUser = useMutation(api.users.resendUser);
  const deleteUser = useMutation(api.users.deleteUser);
  const deletePendingUser = useMutation(api.users.deletePendingUser);

  const [isRegistering, setIsRegistering] = useState(false);
  const [userToApprove, setUserToApprove] = useState<MasterUserRow | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [userToEditPlan, setUserToEditPlan] = useState<MasterUserRow | null>(null);
  const [planConfirmState, setPlanConfirmState] = useState<{
    user: MasterUserRow;
    planId: Id<"plans">;
    planName: string;
  } | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [actingUserId, setActingUserId] = useState<Id<"users"> | null>(null);
  const [userToRevoke, setUserToRevoke] = useState<MasterUserRow | null>(null);
  const [userToResend, setUserToResend] = useState<MasterUserRow | null>(null);
  const [userToDelete, setUserToDelete] = useState<MasterUserRow | null>(null);
  const [userToEditRole, setUserToEditRole] = useState<MasterUserRow | null>(null);
  const [roleConfirmState, setRoleConfirmState] = useState<{
    user: MasterUserRow;
    roleId: Id<"roles">;
    roleLabel: string;
  } | null>(null);
  const [isSavingRole, setIsSavingRole] = useState(false);

  const roleOptions = useQuery(
    api.users.listRoleOptions,
    sessionToken ? { sessionToken } : "skip",
  );
  const businessOptions = useQuery(
    api.businesses.listBusinessOptions,
    sessionToken ? { sessionToken } : "skip",
  );
  const sportOptions = useQuery(api.sports.listSports);
  const planOptions = useQuery(
    api.plans.listPlans,
    isSuperAdmin ? {} : "skip",
  );
  const editableRoleOptions = useQuery(
    api.users.listEditableRoleOptions,
    sessionToken && userToEditRole
      ? { sessionToken, targetUserId: userToEditRole._id }
      : "skip",
  );
  const userStats = useQuery(
    api.adminStats.getUserListStats,
    sessionToken && isSuperAdmin ? { sessionToken } : "skip",
  );

  const businessFilterOptions = useMemo(
    () =>
      (businessOptions ?? []).map((option) => ({
        ...option,
        variant: "business" as const,
      })),
    [businessOptions],
  );

  const planFilterOptions = useMemo(
    () =>
      planOptions
        ? [
            ...planOptions.map((plan) => ({
              ...plan,
              variant: "plan" as const,
            })),
            {
              value: "__default__",
              label: translate("usersNoPlan"),
              planName: translate("usersNoPlan"),
              variant: "plan" as const,
            },
          ]
        : [],
    [planOptions, translate],
  );

  const userStatusOptions = useMemo(
    () => buildUserStatusOptions(translate),
    [translate],
  );

  const translatedSportOptions = useMemo(
    () => mapSportSelectOptions(sportOptions ?? [], translate),
    [sportOptions, translate],
  );

  const filterFields = useMemo(
    () =>
      buildUsersFilterFields(
        {
          search: translate("usersFilterSearch"),
          searchPlaceholder: translate("usersFilterSearchPlaceholder"),
          role: translate("usersFilterRole"),
          rolePlaceholder: translate("usersFilterRolePlaceholder"),
          business: translate("usersFilterBusiness"),
          businessPlaceholder: translate("usersFilterBusinessPlaceholder"),
          sport: translate("usersFilterSport"),
          sportPlaceholder: translate("usersFilterSportPlaceholder"),
          sportEmpty: translate("usersFilterSportEmpty"),
          status: translate("usersFilterStatus"),
          statusPlaceholder: translate("usersFilterStatusPlaceholder"),
          plan: translate("usersFilterPlan"),
          planPlaceholder: translate("usersFilterPlanPlaceholder"),
          roleEmpty: translate("usersFilterRoleEmpty"),
          businessEmpty: translate("usersFilterBusinessEmpty"),
          planEmpty: translate("usersFilterPlanEmpty"),
        },
        {
          isSuperAdmin,
          planOptions: planFilterOptions,
          statusOptions: userStatusOptions,
        },
      ),
    [isSuperAdmin, planFilterOptions, translate, userStatusOptions],
  );
  const {
    draftValues,
    appliedValues,
    setDraftValues,
    applyFilters,
    resetFilters,
  } = useFilterState(filterFields);

  const search =
    typeof appliedValues.search === "string" ? appliedValues.search : "";
  const roleIds = (
    Array.isArray(appliedValues.roleIds) ? appliedValues.roleIds : []
  ) as Id<"roles">[];
  const businessIds = (
    Array.isArray(appliedValues.businessIds) ? appliedValues.businessIds : []
  ) as Id<"businesses">[];
  const sportIds = (
    Array.isArray(appliedValues.sportIds) ? appliedValues.sportIds : []
  ) as Id<"sports">[];
  const statuses = (
    Array.isArray(appliedValues.statuses) ? appliedValues.statuses : []
  ) as ("PENDING" | "APPROVED" | "REVOKED")[];
  const planFilterKeys = Array.isArray(appliedValues.planFilterKeys)
    ? appliedValues.planFilterKeys
    : [];

  const users = useQuery(
    api.users.listUsers,
    sessionToken
      ? {
          sessionToken,
          search: search.trim() || undefined,
          roleIds: roleIds.length > 0 ? roleIds : undefined,
          businessIds: businessIds.length > 0 ? businessIds : undefined,
          sportIds: sportIds.length > 0 ? sportIds : undefined,
          statuses: statuses.length > 0 ? statuses : undefined,
          planFilterKeys:
            isSuperAdmin && planFilterKeys.length > 0
              ? planFilterKeys
              : undefined,
        }
      : "skip",
  );

  const handleConfirmApproveAdmin = useCallback(async () => {
    if (!userToApprove || !sessionToken) {
      showToast({
        type: "error",
        message: translate(
          userToApprove?.roleName === "PENDING"
            ? "usersApprovePendingError"
            : "usersApproveAdminError",
        ),
      });
      return;
    }

    const isPendingRoleUser = userToApprove.roleName === "PENDING";
    setIsApproving(true);

    try {
      const result = isPendingRoleUser
        ? await approvePendingUser({
            sessionToken,
            userId: userToApprove._id,
          })
        : await approvePendingAdmin({
            sessionToken,
            userId: userToApprove._id,
          });
      setUserToApprove(null);
      showToast({
        type: "success",
        message: `${translate(
          isPendingRoleUser
            ? "usersApprovePendingSuccess"
            : "usersApproveAdminSuccess",
        )} (${result.email})`,
      });
    } catch (error) {
      console.error("Approve user failed:", error);
      showToast({
        type: "error",
        message: translate(
          isPendingRoleUser
            ? "usersApprovePendingError"
            : "usersApproveAdminError",
        ),
      });
    } finally {
      setIsApproving(false);
    }
  }, [
    approvePendingAdmin,
    approvePendingUser,
    sessionToken,
    showToast,
    translate,
    userToApprove,
  ]);

  const handleRequestSavePlan = useCallback(
    (planId: Id<"plans">) => {
      if (!userToEditPlan) return;

      const planName =
        planOptions?.find((plan) => plan.value === planId)?.label ?? "";

      setPlanConfirmState({
        user: userToEditPlan,
        planId,
        planName,
      });
      setUserToEditPlan(null);
    },
    [planOptions, userToEditPlan],
  );

  const handleConfirmSavePlan = useCallback(async () => {
    if (!planConfirmState || !sessionToken) return;

    setIsSavingPlan(true);

    try {
      await assignPlanToUser({
        sessionToken,
        userId: planConfirmState.user._id,
        planId: planConfirmState.planId,
      });
      setPlanConfirmState(null);
      showToast({
        type: "success",
        message: translate("usersEditPlanSuccess"),
      });
    } catch (error) {
      console.error("Assign plan failed:", error);
      const message = String(error);
      showToast({
        type: "error",
        message: message.includes("PLAN_ONLY_FOR_ADMIN")
          ? translate("usersEditPlanAdminOnly")
          : translate("usersEditPlanError"),
      });
    } finally {
      setIsSavingPlan(false);
    }
  }, [assignPlanToUser, planConfirmState, sessionToken, showToast, translate]);

  const handleConfirmRevoke = useCallback(async () => {
    if (!userToRevoke || !sessionToken) return;

    setActingUserId(userToRevoke._id);

    try {
      await revokeUser({
        sessionToken,
        userId: userToRevoke._id,
      });
      setUserToRevoke(null);
      showToast({
        type: "success",
        message: translate("businessStaffRevokeSuccess"),
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
            : translate("businessStaffActionError"),
      });
    } finally {
      setActingUserId(null);
    }
  }, [revokeUser, sessionToken, showToast, translate, userToRevoke]);

  const handleConfirmResend = useCallback(async () => {
    if (!userToResend || !sessionToken) return;

    setActingUserId(userToResend._id);

    try {
      await resendUser({
        sessionToken,
        userId: userToResend._id,
      });
      setUserToResend(null);
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
          : message.includes("CANNOT_EDIT_SELF") ||
              message.includes("FORBIDDEN") ||
              message.includes("TARGET_OUT_OF_SCOPE")
            ? translate("usersEditAccessForbidden")
            : translate("businessStaffActionError"),
      });
    } finally {
      setActingUserId(null);
    }
  }, [resendUser, sessionToken, showToast, translate, userToResend]);

  const handleConfirmDelete = useCallback(async () => {
    if (!userToDelete || !sessionToken) return;

    const isPendingRoleUser =
      userToDelete.status === "PENDING" && userToDelete.roleName === "PENDING";

    setActingUserId(userToDelete._id);

    try {
      if (isPendingRoleUser) {
        await deletePendingUser({
          sessionToken,
          userId: userToDelete._id,
        });
      } else {
        await deleteUser({
          sessionToken,
          userId: userToDelete._id,
        });
      }
      setUserToDelete(null);
      showToast({
        type: "success",
        message: translate(
          isPendingRoleUser
            ? "usersDeletePendingSuccess"
            : "businessStaffDeleteSuccess",
        ),
      });
    } catch (error) {
      const message = String(error);
      showToast({
        type: "error",
        message: isPendingRoleUser
          ? translate("usersDeletePendingError")
          : message.includes("CANNOT_DELETE_SELF")
            ? translate("usersEditAccessSelf")
            : message.includes("CANNOT_DELETE_NON_STAFF")
              ? translate("businessStaffDeleteNonStaff")
              : message.includes("USER_NOT_DELETABLE")
                ? translate("businessStaffDeleteNotRevoked")
                : translate("businessStaffActionError"),
      });
    } finally {
      setActingUserId(null);
    }
  }, [
    deletePendingUser,
    deleteUser,
    sessionToken,
    showToast,
    translate,
    userToDelete,
  ]);

  const handleRequestSaveRole = useCallback(
    (roleId: Id<"roles">) => {
      if (!userToEditRole) return;

      const roleLabel =
        editableRoleOptions?.find((role) => role.value === roleId)?.label ?? "";

      setRoleConfirmState({
        user: userToEditRole,
        roleId,
        roleLabel,
      });
      setUserToEditRole(null);
    },
    [editableRoleOptions, userToEditRole],
  );

  const handleConfirmSaveRole = useCallback(async () => {
    if (!roleConfirmState || !sessionToken) return;

    setIsSavingRole(true);

    try {
      await updateUserAccess({
        sessionToken,
        userId: roleConfirmState.user._id,
        status: roleConfirmState.user.status,
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

  const userStatsSections = useMemo(() => {
    if (!userStats) {
      return [];
    }

    const mapEntries = (record: Record<string, number>) =>
      Object.entries(record)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([label, value]) => ({
          label: label.replace(/_/g, " "),
          value,
        }));

    return [
      {
        title: translate("usersAdminStatsStatus"),
        items: userStatusOptions.map((option) => ({
          label: option.label,
          value: userStats.byStatus[option.value],
        })),
        total: {
          label: translate("usersAdminStatsTotal"),
          value: userStats.total,
        },
      },
      {
        title: translate("usersAdminStatsRole"),
        items: mapEntries(userStats.byRole),
      },
      {
        title: translate("usersAdminStatsPlan"),
        items: mapEntries(userStats.byPlan),
      },
    ];
  }, [translate, userStats, userStatusOptions]);

  const columns = useMemo(
    () =>
      buildUsersTableColumns(
        {
          name: translate("usersColName"),
          role: translate("usersColRole"),
          status: translate("usersColStatus"),
          plan: translate("usersColPlan"),
          businesses: translate("usersColBusiness"),
          joined: translate("usersColJoined"),
          noBusiness: translate("usersNoBusiness"),
          noPlan: translate("usersNoPlan"),
          pendingInvite: translate("usersBusinessPendingInvite"),
          actions: translate("usersColActions"),
          approveAdmin: translate("usersApproveAdmin"),
          approvePending: translate("usersApprovePending"),
          editPlan: translate("usersEditPlan"),
          editRole: translate("businessStaffEditRole"),
          revoke: translate("businessStaffRevoke"),
          resend: translate("businessStaffResend"),
          delete: translate("businessStaffDelete"),
        },
        {
          isSuperAdmin,
          currentUserId: user?._id,
          formatUserStatus: (status) => translateUserStatus(translate, status),
          formatSportName: (slug, fallbackName) =>
            translateSportName(translate, slug, fallbackName),
        },
        {
          onApproveRequest: setUserToApprove,
          onEditPlan: setUserToEditPlan,
          onEditRole: setUserToEditRole,
          onRequestRevoke: setUserToRevoke,
          onRequestResend: setUserToResend,
          onRequestDelete: setUserToDelete,
          actingUserId,
        },
      ),
    [actingUserId, isSuperAdmin, translate, user?._id],
  );

  const handleRegisterAdmin = async (response: CredentialResponse) => {
    if (!response.credential) {
      showToast({
        type: "error",
        message: translate("usersRegisterPendingAdminError"),
      });
      return;
    }

    if (!sessionToken) {
      showToast({
        type: "error",
        message: translate("usersRegisterPendingAdminError"),
      });
      return;
    }

    setIsRegistering(true);

    try {
      const result = await registerPendingAdmin({
        sessionToken,
        idToken: response.credential,
      });

      showToast({
        type: "success",
        message: `${translate("usersRegisterPendingAdminSuccess")} (${result.email})`,
      });
    } catch (error) {
      showToast({
        type: "error",
        message: getRegisterAdminErrorMessage(error, translate),
      });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <PermissionGuard permission="master_akun">
      <PageTopSection>
        <PageHeader
          embedded
          title={translate("pageUsersTitle")}
          subtitle={translate(
            isSuperAdmin ? "pageUsersSubtitle" : "pageUsersSubtitleAdmin",
          )}
        />
        {isSuperAdmin && (
          <GoogleSignInButton
            label={translate("usersRegisterPendingAdmin")}
            variant="secondary"
            size="md"
            fullWidth
            className="w-full shrink-0 sm:w-auto"
            loading={isRegistering}
            onSuccess={(response) => void handleRegisterAdmin(response)}
            onError={() =>
              showToast({
                type: "error",
                message: translate("usersRegisterPendingAdminError"),
              })
            }
          />
        )}
      </PageTopSection>

      {isSuperAdmin && (
        <AdminListStats
          sections={userStatsSections}
          isLoading={userStats === undefined}
        />
      )}

      <div className="mb-4">
        <ResponsiveFilterBar
          fields={filterFields}
          draftValues={draftValues}
          appliedValues={appliedValues}
          onDraftChange={setDraftValues}
          onApply={applyFilters}
          onReset={resetFilters}
          optionMap={{
            roles: roleOptions ?? [],
            businesses: businessFilterOptions,
            sports: translatedSportOptions,
          }}
          applyLabel={translate("filterApply")}
          resetLabel={translate("filterReset")}
          panelTitle={translate("filterPanelTitle")}
          emptyFilterLabel={translate("filterEmptyApplied")}
        />
      </div>

      <DataTable
        columns={columns}
        data={users ?? []}
        getRowKey={(row) => row._id}
        isLoading={users === undefined}
        emptyMessage={translate("usersEmpty")}
      />

      <ConfirmModal
        open={userToApprove !== null}
        onClose={() => {
          if (!isApproving) {
            setUserToApprove(null);
          }
        }}
        onConfirm={() => void handleConfirmApproveAdmin()}
        title={translate(
          userToApprove?.roleName === "PENDING"
            ? "usersApprovePendingConfirmTitle"
            : "usersApproveAdminConfirmTitle",
        )}
        description={
          userToApprove
            ? translate(
                userToApprove.roleName === "PENDING"
                  ? "usersApprovePendingConfirmDesc"
                  : "usersApproveAdminConfirmDesc",
              )
                .replace("{name}", userToApprove.name)
                .replace("{email}", userToApprove.email)
            : undefined
        }
        confirmLabel={translate(
          userToApprove?.roleName === "PENDING"
            ? "usersApprovePending"
            : "usersApproveAdmin",
        )}
        cancelLabel={translate("cancel")}
        loading={isApproving}
      />

      <ConfirmModal
        open={planConfirmState !== null}
        onClose={() => {
          if (!isSavingPlan) {
            setPlanConfirmState(null);
          }
        }}
        onConfirm={() => void handleConfirmSavePlan()}
        title={translate("usersEditPlanConfirmTitle")}
        description={
          planConfirmState
            ? translate("usersEditPlanConfirmDesc")
                .replace("{name}", planConfirmState.user.name)
                .replace("{plan}", planConfirmState.planName)
            : undefined
        }
        confirmLabel={translate("usersEditPlanSave")}
        cancelLabel={translate("cancel")}
        loading={isSavingPlan}
      />

      <ConfirmModal
        open={userToRevoke !== null}
        onClose={() => {
          if (actingUserId === null) {
            setUserToRevoke(null);
          }
        }}
        onConfirm={() => void handleConfirmRevoke()}
        title={translate("businessStaffRevokeConfirmTitle")}
        description={
          userToRevoke
            ? translate("businessStaffRevokeConfirmDesc")
                .replace("{email}", userToRevoke.email)
                .replace(
                  "{status}",
                  translateUserStatus(translate, userToRevoke.status),
                )
                .replace(
                  "{nextStatus}",
                  translateUserStatus(translate, "REVOKED"),
                )
            : undefined
        }
        confirmLabel={translate("businessStaffRevoke")}
        cancelLabel={translate("cancel")}
        confirmVariant="danger"
        loading={actingUserId !== null}
      />

      <ConfirmModal
        open={userToResend !== null}
        onClose={() => {
          if (actingUserId === null) {
            setUserToResend(null);
          }
        }}
        onConfirm={() => void handleConfirmResend()}
        title={translate("businessStaffResendConfirmTitle")}
        description={
          userToResend
            ? translate("businessStaffResendConfirmDesc")
                .replace("{email}", userToResend.email)
                .replace(
                  "{status}",
                  translateUserStatus(translate, "REVOKED"),
                )
                .replace(
                  "{nextStatus}",
                  translateUserStatus(translate, "PENDING"),
                )
            : undefined
        }
        confirmLabel={translate("businessStaffResend")}
        cancelLabel={translate("cancel")}
        loading={actingUserId !== null}
      />

      <ConfirmModal
        open={userToDelete !== null}
        onClose={() => {
          if (actingUserId === null) {
            setUserToDelete(null);
          }
        }}
        onConfirm={() => void handleConfirmDelete()}
        title={translate(
          userToDelete?.roleName === "PENDING"
            ? "usersDeletePendingConfirmTitle"
            : "businessStaffDeleteConfirmTitle",
        )}
        description={
          userToDelete
            ? translate(
                userToDelete.roleName === "PENDING"
                  ? "usersDeletePendingConfirmDesc"
                  : "businessStaffDeleteConfirmDesc",
              ).replace("{email}", userToDelete.email)
            : undefined
        }
        confirmLabel={translate("businessStaffDelete")}
        cancelLabel={translate("cancel")}
        confirmVariant="danger"
        loading={actingUserId !== null}
      />

      <EditUserRoleModal
        open={userToEditRole !== null}
        userName={userToEditRole?.name ?? ""}
        currentRoleId={userToEditRole?.roleId ?? ("" as Id<"roles">)}
        roleOptions={editableRoleOptions ?? []}
        isSaving={isSavingRole}
        labels={{
          title: translate("businessStaffEditRoleTitle"),
          description: translate("businessStaffEditRoleDesc"),
          role: translate("usersColRole"),
          rolePlaceholder: translate("usersEditAccessRolePlaceholder"),
          roleEmpty: translate("usersFilterRoleEmpty"),
          save: translate("businessStaffEditRoleSave"),
          cancel: translate("cancel"),
        }}
        onClose={() => {
          if (!isSavingRole) {
            setUserToEditRole(null);
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
                .replace("{name}", roleConfirmState.user.name)
                .replace("{role}", roleConfirmState.roleLabel)
            : undefined
        }
        confirmLabel={translate("businessStaffEditRoleSave")}
        cancelLabel={translate("cancel")}
        loading={isSavingRole}
      />

      {isSuperAdmin && (
        <EditUserPlanModal
          open={userToEditPlan !== null}
          userName={userToEditPlan?.name ?? ""}
          currentPlanId={userToEditPlan?.planId ?? null}
          planOptions={
            planOptions?.map((plan) => ({
              ...plan,
              variant: "plan" as const,
            })) ?? []
          }
          isSaving={isSavingPlan}
          labels={{
            title: translate("usersEditPlanTitle"),
            description: translate("usersEditPlanDesc"),
            plan: translate("usersColPlan"),
            planPlaceholder: translate("usersEditPlanPlaceholder"),
            noPlan: translate("usersNoPlan"),
            save: translate("usersEditPlanSave"),
            cancel: translate("cancel"),
          }}
          onClose={() => {
            if (!isSavingPlan) {
              setUserToEditPlan(null);
            }
          }}
          onSave={handleRequestSavePlan}
        />
      )}
    </PermissionGuard>
  );
}
