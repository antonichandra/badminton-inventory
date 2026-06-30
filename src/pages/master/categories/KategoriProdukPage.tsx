import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Plus, Sparkles } from "lucide-react";
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
  buildCategoryFilterFields,
  buildCategoryTableColumns,
  type CategoryRow,
  type CategoryStatusFilter,
} from "./categories.config";
import { CategoryFormModal } from "./CategoryFormModal";

export function KategoriProdukPage() {
  const { translate } = useLanguage();
  const { sessionToken } = useAuth();
  const { activeBusinessId } = useBusiness();
  const { showToast } = useToast();
  const seedDefaultCategories = useMutation(
    api.productCategories.seedDefaultCategories,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(
    null,
  );
  const [isSeeding, setIsSeeding] = useState(false);

  const filterFields = useMemo(
    () =>
      buildCategoryFilterFields({
        search: translate("categoryFilterSearch"),
        searchPlaceholder: translate("categoryFilterSearchPlaceholder"),
        status: translate("categoryFilterStatus"),
        statusPlaceholder: translate("categoryFilterStatusPlaceholder"),
        active: translate("categoryActive"),
        inactive: translate("categoryInactive"),
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
  ) as CategoryStatusFilter[];

  const categories = useQuery(
    api.productCategories.listCategories,
    sessionToken
      ? {
          sessionToken,
          businessId: activeBusinessId ?? undefined,
          search: search.trim() || undefined,
          statuses: statuses.length > 0 ? statuses : undefined,
        }
      : "skip",
  );

  const handleEdit = useCallback((row: CategoryRow) => {
    setEditingCategory(row);
    setFormOpen(true);
  }, []);

  const columns = useMemo(
    () =>
      buildCategoryTableColumns(
        {
          name: translate("categoryColName"),
          products: translate("categoryColProducts"),
          productsCount: translate("categoryProductsCount"),
          sortOrder: translate("categorySortOrder"),
          status: translate("categoryColStatus"),
          active: translate("categoryActive"),
          inactive: translate("categoryInactive"),
          edit: translate("categoryEdit"),
        },
        handleEdit,
      ),
    [translate, handleEdit],
  );

  const handleSeedDefaults = async () => {
    setIsSeeding(true);
    try {
      const result = await seedDefaultCategories({ sessionToken: sessionToken! });
      showToast({
        type: "success",
        message:
          result.created > 0
            ? translate("categorySeedSuccess")
            : translate("categorySeedExists"),
      });
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: translate("unexpectedError") });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <PermissionGuard permission="master_produk">
      <PageTopSection>
        <PageHeader
          embedded
          title={translate("pageCategoryTitle")}
          subtitle={translate("pageCategorySubtitle")}
        />
        <div className="flex flex-wrap gap-2">
          {(categories?.length ?? 0) === 0 && (
            <Button
              variant="outline"
              onClick={handleSeedDefaults}
              loading={isSeeding}
            >
              <Sparkles className="h-4 w-4" />
              {translate("categorySeedDefaults")}
            </Button>
          )}
          <Button
            variant="secondary"
            className="w-full shrink-0 sm:w-auto"
            onClick={() => {
              setEditingCategory(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {translate("categoryAdd")}
          </Button>
        </div>
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
        data={categories ?? []}
        getRowKey={(row) => row._id}
        emptyMessage={translate("categoryEmpty")}
        isLoading={sessionToken !== null && categories === undefined}
      />

      {sessionToken && (
        <CategoryFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          sessionToken={sessionToken}
          category={editingCategory}
          onSuccess={() =>
            showToast({
              type: "success",
              message: editingCategory
                ? translate("categoryUpdateSuccess")
                : translate("categoryCreateSuccess"),
            })
          }
        />
      )}
    </PermissionGuard>
  );
}
