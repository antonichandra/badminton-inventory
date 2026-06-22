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
import { formatRupiah } from "./utils";

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

  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, string>>({});
  const [costByProduct, setCostByProduct] = useState<Record<string, string>>(
    {},
  );
  const [packQtyByProduct, setPackQtyByProduct] = useState<
    Record<string, string>
  >({});
  const [packPriceByProduct, setPackPriceByProduct] = useState<
    Record<string, string>
  >({});
  const [expiryByProduct, setExpiryByProduct] = useState<
    Record<string, string>
  >({});
  const [isSaving, setIsSaving] = useState(false);

  const supplierProducts = useQuery(
    api.products.listRetailProductsForSupplier,
    supplierId
      ? {
          sessionToken,
          businessId,
          supplierId: supplierId as Id<"suppliers">,
        }
      : "skip",
  );

  const products = supplierProducts?.products ?? [];
  const hasProductLinks = supplierProducts?.hasProductLinks ?? false;

  const clearProductInputs = () => {
    setQtyByProduct({});
    setCostByProduct({});
    setPackQtyByProduct({});
    setPackPriceByProduct({});
    setExpiryByProduct({});
    setProductSearch("");
  };

  const handleSupplierChange = (value: string) => {
    setSupplierId(value);
    clearProductInputs();
  };

  const supplierOptions = useMemo(
    () =>
      (suppliers ?? []).map((supplier) => ({
        value: supplier.value,
        label: supplier.label,
      })),
    [suppliers],
  );

  const productRows = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      product.name.toLowerCase().includes(term),
    );
  }, [products, productSearch]);

  type ReceiptProduct = (typeof products)[number];

  const resolveItem = (product: ReceiptProduct) => {
    const packSize = product.unitsPerPurchaseUnit;
    if (packSize && packSize >= 1) {
      const packQty = Number(packQtyByProduct[product._id] ?? "0") || 0;
      const packPrice = Number(packPriceByProduct[product._id] ?? "0") || 0;
      return {
        productId: product._id as Id<"products">,
        qty: packQty * packSize,
        unitCost: packQty > 0 ? packPrice / packSize : 0,
        packQty,
        packPrice,
        packSize,
        trackExpiry: product.trackExpiry ?? false,
      };
    }

    return {
      productId: product._id as Id<"products">,
      qty: Number(qtyByProduct[product._id] ?? "0") || 0,
      unitCost: Number(costByProduct[product._id] ?? "0") || 0,
      packQty: 0,
      packPrice: 0,
      packSize: undefined as number | undefined,
      trackExpiry: product.trackExpiry ?? false,
    };
  };

  const handleSubmit = async () => {
    if (!supplierId) return;

    const allProducts = products;
    const items = allProducts
      .map((product) => {
        const resolved = resolveItem(product);
        return {
          ...resolved,
          expiresAt: expiryByProduct[product._id]
            ? new Date(expiryByProduct[product._id]).getTime()
            : undefined,
        };
      })
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
        items: items.map(
          ({ trackExpiry: _, packQty, packPrice, packSize, ...item }) => item,
        ),
      });
      showToast({
        type: "success",
        message: translate("kasirActionSuccess"),
      });
      setQtyByProduct({});
      setCostByProduct({});
      setPackQtyByProduct({});
      setPackPriceByProduct({});
      setExpiryByProduct({});
      setNote("");
      setProductSearch("");
      setDueDate("");
      setSupplierId("");
      onClose();
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error &&
        error.message === "PRODUCT_NOT_LINKED_TO_SUPPLIER"
          ? translate("kasirNoLinkedProducts")
          : translate("unexpectedError");
      showToast({ type: "error", message });
    } finally {
      setIsSaving(false);
    }
  };

  const hasItems = products.some((product) => {
    const resolved = resolveItem(product);
    return resolved.qty > 0;
  });

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
            onChange={handleSupplierChange}
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
            {!supplierId ? (
              <p className="text-center text-sm text-slate-500">
                {translate("kasirSelectSupplierFirst")}
              </p>
            ) : hasProductLinks && products.length === 0 ? (
              <p className="text-center text-sm text-slate-500">
                {translate("kasirNoLinkedProducts")}
              </p>
            ) : productRows.length === 0 ? (
              <p className="text-center text-sm text-slate-500">
                {translate("kasirReceiptNoProducts")}
              </p>
            ) : (
              productRows.map((product) => {
                const packSize = product.unitsPerPurchaseUnit;
                const usesPack = packSize != null && packSize >= 1;
                const packQty = Number(packQtyByProduct[product._id] ?? "0") || 0;
                const packPrice =
                  Number(packPriceByProduct[product._id] ?? "0") || 0;
                const unitCost = usesPack && packQty > 0 ? packPrice / packSize : 0;
                const totalQty = usesPack ? packQty * packSize : 0;

                return (
                  <div
                    key={product._id}
                    className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {product.name}
                    </p>
                    {usesPack ? (
                      <>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <InputNumber
                            label={translate("kasirPackQty")}
                            value={packQtyByProduct[product._id] ?? ""}
                            onChange={(v) =>
                              setPackQtyByProduct((prev) => ({
                                ...prev,
                                [product._id]: v,
                              }))
                            }
                            min={0}
                          />
                          <InputNumber
                            label={translate("kasirPackPrice")}
                            value={packPriceByProduct[product._id] ?? ""}
                            onChange={(v) =>
                              setPackPriceByProduct((prev) => ({
                                ...prev,
                                [product._id]: v,
                              }))
                            }
                            min={0}
                            format="currency"
                          />
                        </div>
                        {packQty > 0 && packPrice > 0 && (
                          <p className="mt-2 text-xs text-slate-500">
                            {translate("kasirPackPreview")
                              .replace("{totalQty}", String(totalQty))
                              .replace("{unit}", product.unit)
                              .replace("{unitCost}", formatRupiah(unitCost))}
                          </p>
                        )}
                      </>
                    ) : (
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
                            setCostByProduct((prev) => ({
                              ...prev,
                              [product._id]: v,
                            }))
                          }
                          min={0}
                          format="currency"
                        />
                      </div>
                    )}
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
                );
              })
            )}
          </div>
        </section>
      </div>
    </BottomSheet>
  );
}
