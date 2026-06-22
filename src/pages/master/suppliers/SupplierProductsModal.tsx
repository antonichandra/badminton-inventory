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
          <div className="max-h-[min(420px,60vh)] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="w-10 px-3 py-2.5" />
                  <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    {translate("productColName")}
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    {translate("productColUnit")}
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                    {translate("productColPrice")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {filteredProducts.map((product) => {
                  const checked = selectedIds.has(product._id);
                  return (
                    <tr
                      key={product._id}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      onClick={() => toggleProduct(product._id)}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProduct(product._id)}
                          onClick={(event) => event.stopPropagation()}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-white">
                        {product.name}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">
                        {product.unit}
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm text-slate-700 dark:text-slate-300">
                        {formatRupiah(product.sellPrice)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
