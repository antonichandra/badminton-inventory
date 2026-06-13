import { useCallback, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { ResponsiveFilterBar } from "../../core/components/filters/ResponsiveFilterBar";
import { PageHeader } from "../../core/components/PageHeader";
import { PageTopSection } from "../../core/components/PageTopSection";
import { PermissionGuard } from "../../core/components/PermissionGuard";
import { DataTable } from "../../core/components/table/DataTable";
import { Button } from "../../core/components/ui/Button";
import { useAuth } from "../../core/context/AuthContext";
import { useBusiness } from "../../core/context/BusinessContext";
import { useToast } from "../../core/context/ToastContext";
import { useFilterState } from "../../core/hooks/useFilterState";
import { useLanguage } from "../../core/context/LanguageContext";
import {
  buildProductFilterFields,
  buildProductTableColumns,
  type ProductRow,
  type ProductStatusFilter,
  type ProductTrackExpiryFilter,
  type ProductTypeFilter,
} from "./products/products.config";
import { ProductFormModal } from "./products/ProductFormModal";
import { ProductPriceHistorySheet } from "./products/ProductPriceHistorySheet";

export function ProdukPage() {
  const { translate } = useLanguage();
  const { sessionToken } = useAuth();
  const { activeBusinessId } = useBusiness();
  const { showToast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [historyProduct, setHistoryProduct] = useState<ProductRow | null>(null);

  const filterFields = useMemo(
    () =>
      buildProductFilterFields({
        search: translate("productFilterSearch"),
        searchPlaceholder: translate("productFilterSearchPlaceholder"),
        type: translate("productFilterType"),
        typePlaceholder: translate("productFilterTypePlaceholder"),
        status: translate("productFilterStatus"),
        statusPlaceholder: translate("productFilterStatusPlaceholder"),
        trackExpiry: translate("productFilterTrackExpiry"),
        trackExpiryPlaceholder: translate("productFilterTrackExpiryPlaceholder"),
        typeRetail: translate("productTypeRetail"),
        typeRental: translate("productTypeRental"),
        active: translate("supplierActive"),
        inactive: translate("supplierInactive"),
        trackExpiryYes: translate("productFilterTrackExpiryYes"),
        trackExpiryNo: translate("productFilterTrackExpiryNo"),
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
  const types = (
    Array.isArray(appliedValues.types) ? appliedValues.types : []
  ) as ProductTypeFilter[];
  const statuses = (
    Array.isArray(appliedValues.statuses) ? appliedValues.statuses : []
  ) as ProductStatusFilter[];
  const trackExpiry = (
    Array.isArray(appliedValues.trackExpiry) ? appliedValues.trackExpiry : []
  ) as ProductTrackExpiryFilter[];

  const products = useQuery(
    api.products.listProducts,
    sessionToken
      ? {
          sessionToken,
          businessId: activeBusinessId ?? undefined,
          search: search.trim() || undefined,
          types: types.length > 0 ? types : undefined,
          statuses: statuses.length > 0 ? statuses : undefined,
          trackExpiry: trackExpiry.length > 0 ? trackExpiry : undefined,
        }
      : "skip",
  );

  const handleEdit = useCallback((row: ProductRow) => {
    setEditingProduct(row);
    setFormOpen(true);
  }, []);

  const handlePriceHistory = useCallback((row: ProductRow) => {
    setHistoryProduct(row);
  }, []);

  const columns = useMemo(
    () =>
      buildProductTableColumns(
        {
          name: translate("productColName"),
          type: translate("productColType"),
          price: translate("productColPrice"),
          buyPrice: translate("productBuyPrice"),
          margin: translate("productMargin"),
          unit: translate("productColUnit"),
          trackExpiry: translate("productColTrackExpiry"),
          trackExpiryYes: translate("productFilterTrackExpiryYes"),
          trackExpiryNo: translate("productFilterTrackExpiryNo"),
          status: translate("productColStatus"),
          typeRetail: translate("productTypeRetail"),
          typeRental: translate("productTypeRental"),
          active: translate("supplierActive"),
          inactive: translate("supplierInactive"),
          edit: translate("productEdit"),
          priceHistory: translate("productPriceHistory"),
        },
        handleEdit,
        handlePriceHistory,
      ),
    [handleEdit, handlePriceHistory, translate],
  );

  const handleAdd = () => {
    setEditingProduct(null);
    setFormOpen(true);
  };

  const handleSuccess = () => {
    showToast({
      type: "success",
      message: editingProduct
        ? translate("productUpdateSuccess")
        : translate("productCreateSuccess"),
    });
  };

  return (
    <PermissionGuard permission="master_produk">
      <PageTopSection>
        <PageHeader
          embedded
          title={translate("pageProdukTitle")}
          subtitle={translate("pageProdukSubtitle")}
        />
        <Button
          variant="secondary"
          className="w-full shrink-0 sm:w-auto"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={handleAdd}
        >
          {translate("productAdd")}
        </Button>
      </PageTopSection>

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
        data={products ?? []}
        getRowKey={(row) => row._id}
        emptyMessage={translate("productEmpty")}
        isLoading={sessionToken !== null && products === undefined}
      />

      {sessionToken && (
        <ProductFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          sessionToken={sessionToken}
          product={editingProduct}
          onSuccess={handleSuccess}
        />
      )}

      {sessionToken && (
        <ProductPriceHistorySheet
          open={historyProduct !== null}
          onClose={() => setHistoryProduct(null)}
          sessionToken={sessionToken}
          product={historyProduct}
        />
      )}
    </PermissionGuard>
  );
}
