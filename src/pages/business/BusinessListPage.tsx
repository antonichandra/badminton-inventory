import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { Plus, RotateCcw } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AdminListStats } from "../../core/components/AdminListStats";
import { PageHeader } from "../../core/components/PageHeader";
import { PageTopSection } from "../../core/components/PageTopSection";
import { PermissionGuard } from "../../core/components/PermissionGuard";
import { ResponsiveFilterBar } from "../../core/components/filters/ResponsiveFilterBar";
import { DataTable } from "../../core/components/table/DataTable";
import { ConfirmModal } from "../../core/components/ui/ConfirmModal";
import { Button } from "../../core/components/ui/Button";
import { useAuth } from "../../core/context/AuthContext";
import { useToast } from "../../core/context/ToastContext";
import { useFilterState } from "../../core/hooks/useFilterState";
import { useLanguage } from "../../core/context/LanguageContext";
import {
  buildBusinessFilterFields,
  buildBusinessTableColumns,
  type BusinessRow,
} from "./business.config";
import {
  mapSportSelectOptions,
  translateSportName,
} from "../../core/i18n/sports";
import { buildBusinessStatusOptions } from "../../core/i18n/statuses";
import { QuotaHeader } from "./components/QuotaHeader";

type ConfirmAction =
  | "setDefault"
  | "requestDelete"
  | "cancelDelete"
  | "approveDelete";

export function BusinessListPage() {
  const { translate } = useLanguage();
  const { sessionToken, acl } = useAuth();
  const isSuperAdmin = acl.includes("master_business");

  const setDefaultBusiness = useMutation(api.businesses.setDefaultBusiness);
  const requestBusinessDeletion = useMutation(
    api.businesses.requestBusinessDeletion,
  );
  const approveBusinessDeletion = useMutation(
    api.businesses.approveBusinessDeletion,
  );
  const cancelBusinessDeletion = useMutation(
    api.businesses.cancelBusinessDeletion,
  );
  const resetInventoryData = useMutation(api.maintenance.resetInventoryData);

  const { showToast } = useToast();
  const [actingBusinessId, setActingBusinessId] =
    useState<Id<"businesses"> | null>(null);
  const [confirmState, setConfirmState] = useState<{
    action: ConfirmAction;
    business: BusinessRow;
  } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showResetInventoryConfirm, setShowResetInventoryConfirm] =
    useState(false);
  const [isResettingInventory, setIsResettingInventory] = useState(false);

  const businessStatusOptions = useMemo(
    () => buildBusinessStatusOptions(translate),
    [translate],
  );

  const filterFields = useMemo(
    () =>
      buildBusinessFilterFields(
        {
          search: translate("businessFilterSearch"),
          searchPlaceholder: translate("businessFilterSearchPlaceholder"),
          owner: translate("businessFilterOwner"),
          ownerPlaceholder: translate("businessFilterOwnerPlaceholder"),
          sport: translate("businessFilterSport"),
          sportPlaceholder: translate("businessFilterSportPlaceholder"),
          sportEmpty: translate("usersFilterRoleEmpty"),
          status: translate("businessFilterStatus"),
          statusPlaceholder: translate("businessFilterStatusPlaceholder"),
        },
        { showOwnerFilter: isSuperAdmin, statusOptions: businessStatusOptions },
      ),
    [businessStatusOptions, isSuperAdmin, translate],
  );

  const {
    draftValues,
    appliedValues,
    setDraftValues,
    applyFilters,
    resetFilters,
  } = useFilterState(filterFields);

  const sportOptions = useQuery(api.sports.listSports);

  const translatedSportOptions = useMemo(
    () => mapSportSelectOptions(sportOptions ?? [], translate),
    [sportOptions, translate],
  );

  const quota = useQuery(
    api.businesses.getQuotaSummary,
    sessionToken ? { sessionToken } : "skip",
  );
  const businessStats = useQuery(
    api.adminStats.getBusinessListStats,
    sessionToken && isSuperAdmin ? { sessionToken } : "skip",
  );

  const search =
    typeof appliedValues.search === "string" ? appliedValues.search : "";
  const ownerSearch =
    typeof appliedValues.ownerSearch === "string"
      ? appliedValues.ownerSearch
      : "";
  const sportIds = (
    Array.isArray(appliedValues.sportIds) ? appliedValues.sportIds : []
  ) as Id<"sports">[];
  const statuses = (
    Array.isArray(appliedValues.statuses) ? appliedValues.statuses : []
  ) as ("ACTIVE" | "DELETE_REQUESTED")[];

  const businesses = useQuery(
    api.businesses.listBusinesses,
    sessionToken
      ? {
          sessionToken,
          search: search.trim() || undefined,
          ownerSearch: isSuperAdmin ? ownerSearch.trim() || undefined : undefined,
          sportIds: sportIds.length > 0 ? sportIds : undefined,
          statuses: statuses.length > 0 ? statuses : undefined,
        }
      : "skip",
  );

  const handleConfirm = useCallback(async () => {
    if (!confirmState || !sessionToken) return;

    setIsConfirming(true);

    try {
      if (confirmState.action === "setDefault") {
        await setDefaultBusiness({
          sessionToken,
          businessId: confirmState.business._id,
        });
        showToast({
          type: "success",
          message: translate("businessSetDefaultSuccess"),
        });
      } else if (confirmState.action === "requestDelete") {
        await requestBusinessDeletion({
          sessionToken,
          businessId: confirmState.business._id,
        });
        showToast({
          type: "success",
          message: translate("businessRequestDeleteSuccess"),
        });
      } else if (confirmState.action === "cancelDelete") {
        await cancelBusinessDeletion({
          sessionToken,
          businessId: confirmState.business._id,
        });
        showToast({
          type: "success",
          message: translate("businessCancelDeleteSuccess"),
        });
      } else {
        await approveBusinessDeletion({
          sessionToken,
          businessId: confirmState.business._id,
        });
        showToast({
          type: "success",
          message: translate("businessApproveDeleteSuccess"),
        });
      }
      setConfirmState(null);
    } catch {
      const errorKey =
        confirmState.action === "setDefault"
          ? "businessSetDefaultError"
          : confirmState.action === "requestDelete"
            ? "businessRequestDeleteError"
            : confirmState.action === "cancelDelete"
              ? "businessCancelDeleteError"
              : "businessApproveDeleteError";
      showToast({
        type: "error",
        message: translate(errorKey),
      });
    } finally {
      setIsConfirming(false);
      setActingBusinessId(null);
    }
  }, [
    approveBusinessDeletion,
    cancelBusinessDeletion,
    confirmState,
    requestBusinessDeletion,
    sessionToken,
    setDefaultBusiness,
    showToast,
    translate,
  ]);

  const handleConfirmResetInventory = useCallback(async () => {
    if (!sessionToken) {
      showToast({
        type: "error",
        message: translate("businessResetInventoryError"),
      });
      return;
    }

    setIsResettingInventory(true);

    try {
      await resetInventoryData({ sessionToken });
      setShowResetInventoryConfirm(false);
      showToast({
        type: "success",
        message: translate("businessResetInventorySuccess"),
      });
    } catch (error) {
      console.error("Reset inventory data failed:", error);
      showToast({
        type: "error",
        message: translate("businessResetInventoryError"),
      });
    } finally {
      setIsResettingInventory(false);
    }
  }, [resetInventoryData, sessionToken, showToast, translate]);

  const columns = useMemo(
    () =>
      buildBusinessTableColumns(
        {
          name: translate("businessColName"),
          sport: translate("businessColSport"),
          phone: translate("businessColPhone"),
          address: translate("businessColAddress"),
          owner: translate("businessColOwner"),
          status: translate("businessColStatus"),
          statusActive: translate("businessStatusActive"),
          statusDeleteRequested: translate("businessStatusDeleteRequested"),
          actions: translate("businessColActions"),
          edit: translate("businessEdit"),
          setDefault: translate("businessSetDefault"),
          requestDelete: translate("businessRequestDelete"),
          approveDelete: translate("businessApproveDelete"),
          cancelDelete: translate("businessCancelDelete"),
          noPhone: translate("placeholderEmpty"),
        },
        {
          showOwnerColumn: isSuperAdmin,
          isSuperAdmin,
          formatSportName: (slug, fallbackName) =>
            translateSportName(translate, slug, fallbackName),
        },
        {
          onSetDefault: (row) => setConfirmState({ action: "setDefault", business: row }),
          onRequestDelete: (row) =>
            setConfirmState({ action: "requestDelete", business: row }),
          onCancelDelete: (row) =>
            setConfirmState({ action: "cancelDelete", business: row }),
          onApproveDelete: (row) =>
            setConfirmState({ action: "approveDelete", business: row }),
          actingBusinessId,
        },
      ),
    [actingBusinessId, isSuperAdmin, translate],
  );

  const canAddBusiness =
    !quota?.showQuota || quota.businessCount < quota.maxBusiness;

  const businessStatsSections = useMemo(() => {
    if (!businessStats) {
      return [];
    }

    return [
      {
        title: translate("businessAdminStatsTitle"),
        items: businessStatusOptions.map((option) => ({
          label: option.label,
          value:
            option.value === "ACTIVE"
              ? businessStats.active
              : businessStats.deleteRequested,
        })),
        total: {
          label: translate("businessAdminStatsTotal"),
          value: businessStats.total,
        },
      },
    ];
  }, [businessStats, businessStatusOptions, translate]);

  const confirmCopy = useMemo(() => {
    if (!confirmState) return null;

    const name = confirmState.business.name;
    if (confirmState.action === "setDefault") {
      return {
        title: translate("businessSetDefaultConfirmTitle"),
        description: translate("businessSetDefaultConfirmDesc").replace(
          "{name}",
          name,
        ),
        confirmLabel: translate("confirm"),
      };
    }
    if (confirmState.action === "requestDelete") {
      return {
        title: translate("businessRequestDeleteConfirmTitle"),
        description: translate("businessRequestDeleteConfirmDesc").replace(
          "{name}",
          name,
        ),
        confirmLabel: translate("businessRequestDelete"),
        confirmVariant: "danger" as const,
      };
    }
    if (confirmState.action === "cancelDelete") {
      return {
        title: translate("businessCancelDeleteConfirmTitle"),
        description: translate("businessCancelDeleteConfirmDesc").replace(
          "{name}",
          name,
        ),
        confirmLabel: translate("businessCancelDelete"),
      };
    }

    return {
      title: translate("businessApproveDeleteConfirmTitle"),
      description: translate("businessApproveDeleteConfirmDesc").replace(
        "{name}",
        name,
      ),
      confirmLabel: translate("businessApproveDelete"),
      confirmVariant: "danger" as const,
    };
  }, [confirmState, translate]);
  
  return (
    <PermissionGuard permissions={["business", "master_business"]}>
      <PageTopSection>
        <PageHeader
          embedded
          title={translate("pageBusinessTitle")}
          subtitle={translate("pageBusinessSubtitle")}
        />
        {canAddBusiness && !isSuperAdmin && (
          <Link to="/business/new" viewTransition className="w-full sm:w-auto">
            <Button
              variant="secondary"
              size="md"
              className="w-full shrink-0 sm:w-auto"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              {translate("businessAddButton")}
            </Button>
          </Link>
        )}
        {isSuperAdmin && (
          <Button
            variant="danger"
            size="md"
            className="w-full shrink-0 sm:w-auto"
            leftIcon={<RotateCcw className="h-4 w-4" />}
            onClick={() => setShowResetInventoryConfirm(true)}
          >
            {translate("businessResetInventory")}
          </Button>
        )}
      </PageTopSection>

      {isSuperAdmin && (
        <AdminListStats
          sections={businessStatsSections}
          isLoading={businessStats === undefined}
        />
      )}

      {quota && (
        <QuotaHeader
          showQuota={quota.showQuota}
          businessCount={quota.businessCount}
          maxBusiness={quota.maxBusiness}
          staffCount={quota.staffCount}
          maxStaff={quota.maxStaff}
          labels={{
            business: translate("businessQuotaBusiness"),
            staff: translate("businessQuotaStaff"),
          }}
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
        data={businesses ?? []}
        getRowKey={(row) => row._id}
        isLoading={businesses === undefined}
        emptyMessage={translate("businessEmpty")}
      />

      {confirmCopy && (
        <ConfirmModal
          open={confirmState !== null}
          onClose={() => {
            if (!isConfirming) {
              setConfirmState(null);
            }
          }}
          onConfirm={() => void handleConfirm()}
          title={confirmCopy.title}
          description={confirmCopy.description}
          confirmLabel={confirmCopy.confirmLabel}
          cancelLabel={translate("cancel")}
          loading={isConfirming}
          confirmVariant={confirmCopy.confirmVariant ?? "primary"}
        />
      )}

      <ConfirmModal
        open={showResetInventoryConfirm}
        onClose={() => {
          if (!isResettingInventory) {
            setShowResetInventoryConfirm(false);
          }
        }}
        onConfirm={() => void handleConfirmResetInventory()}
        title={translate("businessResetInventoryConfirmTitle")}
        description={translate("businessResetInventoryConfirmDesc")}
        confirmLabel={translate("businessResetInventory")}
        cancelLabel={translate("cancel")}
        loading={isResettingInventory}
        confirmVariant="danger"
      />
    </PermissionGuard>
  );
}
