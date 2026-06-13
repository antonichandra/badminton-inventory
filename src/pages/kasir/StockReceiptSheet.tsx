import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { BottomSheet } from "../../core/components/ui/BottomSheet";
import { Button } from "../../core/components/ui/Button";
import { Dropdown } from "../../core/components/forms/Dropdown";
import { InputNumber } from "../../core/components/forms/InputNumber";
import { InputText } from "../../core/components/forms/InputText";
import { useLanguage } from "../../core/context/LanguageContext";
import { useToast } from "../../core/context/ToastContext";

interface StockReceiptSheetProps {
  open: boolean;
  onClose: () => void;
  sessionToken: string;
  businessId: Id<"businesses">;
  onBack?: () => void;
}

export function StockReceiptSheet({
  open,
  onClose,
  sessionToken,
  businessId,
  onBack,
}: StockReceiptSheetProps) {
  const { translate } = useLanguage();
  const { showToast } = useToast();
  const addStockReceipt = useMutation(api.shifts.addStockReceipt);

  const suppliers = useQuery(api.suppliers.listSuppliersForKasir, {
    sessionToken,
    businessId,
  });
  const products = useQuery(api.products.listRetailProductsForShift, {
    sessionToken,
    businessId,
  });

  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, string>>({});
  const [costByProduct, setCostByProduct] = useState<Record<string, string>>(
    {},
  );
  const [expiryByProduct, setExpiryByProduct] = useState<
    Record<string, string>
  >({});
  const [isSaving, setIsSaving] = useState(false);

  const supplierOptions = useMemo(
    () =>
      (suppliers ?? []).map((supplier) => ({
        value: supplier.value,
        label: supplier.label,
      })),
    [suppliers],
  );

  const productRows = useMemo(() => {
    const rows = products ?? [];
    const term = productSearch.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((product) =>
      product.name.toLowerCase().includes(term),
    );
  }, [products, productSearch]);

  const handleSubmit = async () => {
    if (!supplierId) return;

    const allProducts = products ?? [];
    const items = allProducts
      .map((product) => ({
        productId: product._id as Id<"products">,
        qty: Number(qtyByProduct[product._id] ?? "0") || 0,
        unitCost: Number(costByProduct[product._id] ?? "0") || 0,
        expiresAt: expiryByProduct[product._id]
          ? new Date(expiryByProduct[product._id]).getTime()
          : undefined,
        trackExpiry: product.trackExpiry ?? false,
      }))
      .filter((item) => item.qty > 0);

    if (items.length === 0) return;

    for (const item of items) {
      if (item.unitCost <= 0) {
        showToast({ type: "error", message: translate("kasirUnitCostRequired") });
        return;
      }
      if (item.trackExpiry && !item.expiresAt) {
        showToast({ type: "error", message: translate("kasirExpiryRequired") });
        return;
      }
    }

    setIsSaving(true);
    try {
      await addStockReceipt({
        sessionToken,
        supplierId: supplierId as Id<"suppliers">,
        note: note || undefined,
        dueAt: dueDate
          ? new Date(`${dueDate}T00:00:00`).getTime()
          : undefined,
        items: items.map(({ trackExpiry: _, ...item }) => item),
      });
      showToast({
        type: "success",
        message: translate("kasirActionSuccess"),
      });
      setQtyByProduct({});
      setCostByProduct({});
      setExpiryByProduct({});
      setNote("");
      setProductSearch("");
      setDueDate("");
      onClose();
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: translate("unexpectedError") });
    } finally {
      setIsSaving(false);
    }
  };

  const hasItems = (products ?? []).some(
    (product) => Number(qtyByProduct[product._id] ?? "0") > 0,
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={translate("kasirStockReceipt")}
      footer={
        <div className="flex gap-2">
          {onBack && (
            <Button variant="ghost" className="flex-1" onClick={onBack}>
              {translate("cancel")}
            </Button>
          )}
          <Button
            className="flex-1"
            onClick={handleSubmit}
            loading={isSaving}
            disabled={isSaving || !supplierId || !hasItems}
          >
            {translate("kasirContinue")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {translate("kasirReceiptInfoSection")}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {translate("kasirReceiptCostHint")}
            </p>
          </div>
          <Dropdown
            label={translate("kasirSupplier")}
            value={supplierId}
            onChange={setSupplierId}
            options={supplierOptions}
            searchable
            required
          />
          <InputText
            label={translate("kasirReceiptNote")}
            value={note}
            onChange={setNote}
          />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              {translate("kasirReceiptDueDate")}
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-9 w-full cursor-pointer rounded-lg border border-slate-200 px-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </section>

        <div
          className="border-t border-slate-200 dark:border-slate-700"
          role="separator"
        />

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {translate("kasirReceiptItemsSection")}
          </h3>
          <InputText
            label={translate("kasirReceiptProductSearch")}
            value={productSearch}
            onChange={setProductSearch}
            placeholder={translate("kasirReceiptProductSearch")}
          />

          <div className="space-y-3">
            {productRows.length === 0 ? (
              <p className="text-center text-sm text-slate-500">
                {translate("kasirReceiptNoProducts")}
              </p>
            ) : (
              productRows.map((product) => (
                <div
                  key={product._id}
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {product.name}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <InputNumber
                      label={translate("kasirQty")}
                      value={qtyByProduct[product._id] ?? ""}
                      onChange={(v) =>
                        setQtyByProduct((prev) => ({ ...prev, [product._id]: v }))
                      }
                      min={0}
                    />
                    <InputNumber
                      label={translate("kasirUnitCost")}
                      value={costByProduct[product._id] ?? ""}
                      onChange={(v) =>
                        setCostByProduct((prev) => ({ ...prev, [product._id]: v }))
                      }
                      min={0}
                      format="currency"
                    />
                  </div>
                  {product.trackExpiry && (
                    <div className="mt-2">
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        {translate("kasirExpiryDate")}
                      </label>
                      <input
                        type="date"
                        value={expiryByProduct[product._id] ?? ""}
                        onChange={(e) =>
                          setExpiryByProduct((prev) => ({
                            ...prev,
                            [product._id]: e.target.value,
                          }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </BottomSheet>
  );
}
