import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { InputText } from "../../../core/components/forms/InputText";
import { Modal } from "../../../core/components/ui/Modal";
import { Button } from "../../../core/components/ui/Button";
import { LoadingState } from "../../../core/components/ui/LoadingState";
import { useBusiness } from "../../../core/context/BusinessContext";
import { useLanguage } from "../../../core/context/LanguageContext";
import { groupByCategory } from "../../../core/utils/groupByCategory";
import { cn } from "../../../core/utils/cn";
import {
  CategoryGroupSection,
  CategoryGroupsContainer,
  compactTdClass,
  compactThClass,
  compactTrClass,
  compactTableClass,
  compactTheadClass,
  compactTbodyClass,
} from "../../../core/components/categoryGroup";
import { formatRupiah } from "../../kasir/utils";
import type { SupplierRow } from "./suppliers.config";

interface SupplierProductsModalProps {
  open: boolean;
  onClose: () => void;
  sessionToken: string;
  supplier: SupplierRow | null;
  onSuccess: () => void;
}

export function SupplierProductsModal({
  open,
  onClose,
  sessionToken,
  supplier,
  onSuccess,
}: SupplierProductsModalProps) {
  const { translate } = useLanguage();
  const { activeBusinessId } = useBusiness();
  const setSupplierProducts = useMutation(api.suppliers.setSupplierProducts);

  const products = useQuery(
    api.products.listProducts,
    open && sessionToken
      ? {
          sessionToken,
          businessId: activeBusinessId ?? undefined,
          types: ["RETAIL"],
        }
      : "skip",
  );

  const linkedProductIds = useQuery(
    api.suppliers.getSupplierProducts,
    open && sessionToken && supplier
      ? {
          sessionToken,
          supplierId: supplier._id,
          businessId: activeBusinessId ?? undefined,
        }
      : "skip",
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !supplier || linkedProductIds === undefined) return;
    setSelectedIds(new Set(linkedProductIds));
    setSearch("");
    setError(null);
  }, [open, supplier, linkedProductIds]);

  const filteredProducts = useMemo(() => {
    const rows = products ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        product.unit.toLowerCase().includes(term),
    );
  }, [products, search]);

  const productGroups = useMemo(
    () => groupByCategory(filteredProducts),
    [filteredProducts],
  );

  const toggleProduct = (productId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!supplier) return;

    setIsSaving(true);
    setError(null);

    try {
      await setSupplierProducts({
        sessionToken,
        supplierId: supplier._id as Id<"suppliers">,
        productIds: [...selectedIds] as Id<"products">[],
      });
      onSuccess();
      onClose();
    } catch (saveError) {
      console.error(saveError);
      setError(translate("unexpectedError"));
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading =
    products === undefined ||
    (supplier !== null && linkedProductIds === undefined);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={translate("supplierLinkedProducts")}
      description={
        supplier
          ? `${supplier.name} · ${translate("supplierLinkedProductsHint")}`
          : translate("supplierLinkedProductsHint")
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            {translate("cancel")}
          </Button>
          <Button onClick={handleSave} loading={isSaving} disabled={isSaving}>
            {translate("supplierSave")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <InputText
          label={translate("productFilterSearch")}
          value={search}
          onChange={setSearch}
          placeholder={translate("productFilterSearchPlaceholder")}
          type="search"
        />

        {isLoading ? (
          <LoadingState variant="inline" />
        ) : filteredProducts.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            {translate("productEmpty")}
          </p>
        ) : (
          <div className="max-h-[min(420px,60vh)] overflow-auto">
            <CategoryGroupsContainer>
            {productGroups.map((group) => {
              const selectedInGroup = group.items.filter((p) =>
                selectedIds.has(p._id),
              ).length;

              return (
              <CategoryGroupSection
                key={group.categoryId ?? group.categoryName}
                categoryName={group.categoryName}
                itemCountLabel={translate("categoryItemCount").replace(
                  "{count}",
                  String(group.items.length),
                )}
                meta={
                  selectedInGroup > 0
                    ? translate("supplierLinkedProductsCount").replace(
                        "{count}",
                        String(selectedInGroup),
                      )
                    : undefined
                }
              >
                <table className={compactTableClass}>
                  <thead className={compactTheadClass}>
                    <tr>
                      <th className={cn(compactThClass, "w-8")} />
                      <th className={compactThClass}>
                        {translate("productColName")}
                      </th>
                      <th className={compactThClass}>
                        {translate("productColUnit")}
                      </th>
                      <th className={cn(compactThClass, "text-right")}>
                        {translate("productColPrice")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className={compactTbodyClass}>
                    {group.items.map((product) => {
                      const checked = selectedIds.has(product._id);
                      return (
                        <tr
                          key={product._id}
                          className={cn(
                            compactTrClass,
                            "cursor-pointer",
                          )}
                          onClick={() => toggleProduct(product._id)}
                        >
                          <td className={compactTdClass}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleProduct(product._id)}
                              onClick={(event) => event.stopPropagation()}
                              className="h-3.5 w-3.5 rounded border-slate-300"
                            />
                          </td>
                          <td
                            className={cn(
                              compactTdClass,
                              "font-medium text-slate-900 dark:text-white",
                            )}
                          >
                            {product.name}
                          </td>
                          <td className={compactTdClass}>{product.unit}</td>
                          <td
                            className={cn(
                              compactTdClass,
                              "text-right tabular-nums",
                            )}
                          >
                            {formatRupiah(product.sellPrice)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CategoryGroupSection>
            );
            })}
            </CategoryGroupsContainer>
          </div>
        )}

        <p className="text-xs text-slate-500">
          {selectedIds.size === 0
            ? translate("supplierLinkedProductsAll")
            : translate("supplierLinkedProductsCount").replace(
                "{count}",
                String(selectedIds.size),
              )}
        </p>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </Modal>
  );
}
