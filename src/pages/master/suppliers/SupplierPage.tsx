import { useCallback, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { ResponsiveFilterBar } from "../../../core/components/filters/ResponsiveFilterBar";
import { PageHeader } from "../../../core/components/PageHeader";
import { PageTopSection } from "../../../core/components/PageTopSection";
import { PermissionGuard } from "../../../core/components/PermissionGuard";
import { DataTable } from "../../../core/components/table/DataTable";
import { Button } from "../../../core/components/ui/Button";
import { useAuth } from "../../../core/context/AuthContext";
import { useBusiness } from "../../../core/context/BusinessContext";
import { useToast } from "../../../core/context/ToastContext";
import { useFilterState } from "../../../core/hooks/useFilterState";
import { useLanguage } from "../../../core/context/LanguageContext";
import {
  buildSupplierFilterFields,
  buildSupplierTableColumns,
  type SupplierRow,
  type SupplierStatusFilter,
} from "./suppliers.config";
import { SupplierFormModal } from "./SupplierFormModal";
import { SupplierProductsModal } from "./SupplierProductsModal";
import { SupplierReceiptsPanel } from "./SupplierReceiptsPanel";

type SupplierTab = "list" | "receipts";

function isAdminRole(roleName: string | undefined): boolean {
  return roleName === "ADMIN" || roleName === "SUPER_ADMIN";
}

export function SupplierPage() {
  const { translate } = useLanguage();
  const { sessionToken, role } = useAuth();
  const { activeBusinessId } = useBusiness();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SupplierTab>("list");
  const [formOpen, setFormOpen] = useState(false);
  const [productsModalOpen, setProductsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierRow | null>(
    null,
  );
  const [productsSupplier, setProductsSupplier] = useState<SupplierRow | null>(
    null,
  );

  const isAdmin = isAdminRole(role?.name);

  const filterFields = useMemo(
    () =>
      buildSupplierFilterFields({
        search: translate("supplierFilterSearch"),
        searchPlaceholder: translate("supplierFilterSearchPlaceholder"),
        status: translate("supplierFilterStatus"),
        statusPlaceholder: translate("supplierFilterStatusPlaceholder"),
        active: translate("supplierActive"),
        inactive: translate("supplierInactive"),
      }),
    [translate],
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
  const statuses = (
    Array.isArray(appliedValues.statuses) ? appliedValues.statuses : []
  ) as SupplierStatusFilter[];

  const suppliers = useQuery(
    api.suppliers.listSuppliers,
    sessionToken
      ? {
          sessionToken,
          businessId: activeBusinessId ?? undefined,
          search: search.trim() || undefined,
          statuses: statuses.length > 0 ? statuses : undefined,
        }
      : "skip",
  );

  const handleEdit = useCallback((row: SupplierRow) => {
    setEditingSupplier(row);
    setFormOpen(true);
  }, []);

  const handleManageProducts = useCallback((row: SupplierRow) => {
    setProductsSupplier(row);
    setProductsModalOpen(true);
  }, []);

  const columns = useMemo(
    () =>
      buildSupplierTableColumns(
        {
          name: translate("supplierColName"),
          description: translate("supplierColDescription"),
          contact: translate("supplierColContact"),
          products: translate("supplierColProducts"),
          productsAll: translate("supplierLinkedProductsAll"),
          productsCount: translate("supplierLinkedProductsCount"),
          status: translate("supplierColStatus"),
          active: translate("supplierActive"),
          inactive: translate("supplierInactive"),
          edit: translate("supplierEdit"),
          manageProducts: translate("supplierManageProducts"),
        },
        handleEdit,
        handleManageProducts,
      ),
    [handleEdit, handleManageProducts, translate],
  );

  const handleAdd = () => {
    setEditingSupplier(null);
    setFormOpen(true);
  };

  const handleSuccess = () => {
    showToast({
      type: "success",
      message: editingSupplier
        ? translate("supplierUpdateSuccess")
        : translate("supplierCreateSuccess"),
    });
  };

  const handleProductsSuccess = () => {
    showToast({
      type: "success",
      message: translate("supplierProductsUpdateSuccess"),
    });
  };

  return (
    <PermissionGuard permission="master_produk">
      <PageTopSection>
        <PageHeader
          embedded
          title={translate("pageSupplierTitle")}
          subtitle={translate("pageSupplierSubtitle")}
        />
        {activeTab === "list" && (
          <Button
            variant="secondary"
            className="w-full shrink-0 sm:w-auto"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={handleAdd}
          >
            {translate("supplierAdd")}
          </Button>
        )}
      </PageTopSection>

      {isAdmin && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={activeTab === "list" ? "primary" : "outline"}
            onClick={() => setActiveTab("list")}
          >
            {translate("supplierTabList")}
          </Button>
          <Button
            size="sm"
            variant={activeTab === "receipts" ? "primary" : "outline"}
            onClick={() => setActiveTab("receipts")}
          >
            {translate("supplierTabReceipts")}
          </Button>
        </div>
      )}

      {activeTab === "receipts" && isAdmin && sessionToken ? (
        <SupplierReceiptsPanel sessionToken={sessionToken} canManage={isAdmin} />
      ) : (
        <>
          <div className="mb-4">
            <ResponsiveFilterBar
              fields={filterFields}
              draftValues={draftValues}
              appliedValues={appliedValues}
              onDraftChange={setDraftValues}
              onApply={applyFilters}
              onReset={resetFilters}
              applyLabel={translate("filterApply")}
              resetLabel={translate("filterReset")}
              panelTitle={translate("filterPanelTitle")}
              emptyFilterLabel={translate("filterEmptyApplied")}
            />
          </div>

          <DataTable
            columns={columns}
            data={suppliers ?? []}
            getRowKey={(row) => row._id}
            emptyMessage={translate("supplierEmpty")}
            isLoading={sessionToken !== null && suppliers === undefined}
          />
        </>
      )}

      {sessionToken && (
        <>
          <SupplierFormModal
            open={formOpen}
            onClose={() => setFormOpen(false)}
            sessionToken={sessionToken}
            supplier={editingSupplier}
            onSuccess={handleSuccess}
          />
          <SupplierProductsModal
            open={productsModalOpen}
            onClose={() => setProductsModalOpen(false)}
            sessionToken={sessionToken}
            supplier={productsSupplier}
            onSuccess={handleProductsSuccess}
          />
        </>
      )}
    </PermissionGuard>
  );
}
