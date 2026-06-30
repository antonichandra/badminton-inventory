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
import { cn } from "../../core/utils/cn";
import { formatRupiah } from "./utils";

interface StockReceiptSheetProps {
  open: boolean;
  onClose: () => void;
  sessionToken: string;
  businessId: Id<"businesses">;
  onBack?: () => void;
}

type ReceiptInputMode = "pack" | "unit";

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
  const [inputModeByProduct, setInputModeByProduct] = useState<
    Record<string, ReceiptInputMode>
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

  const clearProductInputs = () => {
    setQtyByProduct({});
    setCostByProduct({});
    setPackQtyByProduct({});
    setPackPriceByProduct({});
    setInputModeByProduct({});
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

  const selectedSupplierName = useMemo(
    () => supplierOptions.find((option) => option.value === supplierId)?.label ?? "",
    [supplierOptions, supplierId],
  );

  const noLinkedProductsMessage = useMemo(
    () =>
      translate("kasirNoLinkedProducts").replace("{name}", selectedSupplierName),
    [translate, selectedSupplierName],
  );

  const productRows = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      product.name.toLowerCase().includes(term),
    );
  }, [products, productSearch]);

  type ReceiptProduct = (typeof products)[number];

  const hasPackConfig = (product: ReceiptProduct) =>
    product.unitsPerPurchaseUnit != null &&
    product.unitsPerPurchaseUnit >= 1 &&
    (product.purchaseUnit?.trim() ?? "") !== "";

  const getInputMode = (
    product: ReceiptProduct,
  ): ReceiptInputMode => {
    if (!hasPackConfig(product)) return "unit";
    return inputModeByProduct[product._id] ?? "pack";
  };

  const resolveItem = (product: ReceiptProduct) => {
    const packSize = product.unitsPerPurchaseUnit ?? 0;
    const mode = getInputMode(product);

    if (hasPackConfig(product) && mode === "pack") {
      const packQty = Number(packQtyByProduct[product._id] ?? "0") || 0;
      const packPrice = Number(packPriceByProduct[product._id] ?? "0") || 0;
      return {
        productId: product._id as Id<"products">,
        qty: packQty * packSize,
        unitCost: packPrice > 0 ? packPrice / packSize : undefined,
        packQty,
        packPrice,
        packSize,
        mode,
        trackExpiry: product.trackExpiry ?? false,
      };
    }

    const qty = Number(qtyByProduct[product._id] ?? "0") || 0;
    const unitCost = Number(costByProduct[product._id] ?? "0") || 0;
    return {
      productId: product._id as Id<"products">,
      qty,
      unitCost: unitCost > 0 ? unitCost : undefined,
      packQty: 0,
      packPrice: 0,
      packSize,
      mode: "unit" as const,
      trackExpiry: product.trackExpiry ?? false,
    };
  };

  const resolveFallbackUnitCost = (product: ReceiptProduct) =>
    product.lastSupplierUnitCost ??
    product.defaultUnitCost ??
    null;

  const handleSubmit = async () => {
    if (!supplierId) return;

    const items = products
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
      const product = products.find((p) => p._id === item.productId);
      if (!product) continue;

      if (
        hasPackConfig(product) &&
        item.mode === "pack" &&
        !Number.isInteger(item.packQty)
      ) {
        showToast({
          type: "error",
          message: translate("kasirReceiptPackQtyInteger"),
        });
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
          ({
            trackExpiry: _,
            packQty,
            packPrice,
            packSize,
            mode,
            ...item
          }) => item,
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
      setInputModeByProduct({});
      setExpiryByProduct({});
      setNote("");
      setProductSearch("");
      setDueDate("");
      setSupplierId("");
      onClose();
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error && error.message === "UNIT_COST_UNAVAILABLE"
          ? translate("kasirUnitCostRequired")
          : error instanceof Error &&
              error.message === "PRODUCT_NOT_LINKED_TO_SUPPLIER"
            ? noLinkedProductsMessage
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
              {translate("kasirReceiptPriceOptional")}
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
            ) : supplierProducts === undefined ? (
              <p className="text-center text-sm text-slate-500">
                {translate("loading")}
              </p>
            ) : products.length === 0 ? (
              <p className="text-center text-sm text-slate-500">
                {noLinkedProductsMessage}
              </p>
            ) : productRows.length === 0 ? (
              <p className="text-center text-sm text-slate-500">
                {translate("kasirReceiptNoProducts")}
              </p>
            ) : (
              productRows.map((product) => {
                const packConfigured = hasPackConfig(product);
                const mode = getInputMode(product);
                const packSize = product.unitsPerPurchaseUnit ?? 0;
                const purchaseUnit = product.purchaseUnit ?? "";
                const packQty =
                  Number(packQtyByProduct[product._id] ?? "0") || 0;
                const packPrice =
                  Number(packPriceByProduct[product._id] ?? "0") || 0;
                const unitQty = Number(qtyByProduct[product._id] ?? "0") || 0;
                const unitPrice =
                  Number(costByProduct[product._id] ?? "0") || 0;
                const fallback = resolveFallbackUnitCost(product);

                const stockQty =
                  packConfigured && mode === "pack"
                    ? packQty * packSize
                    : unitQty;

                const effectiveUnitCost =
                  packConfigured && mode === "pack"
                    ? packPrice > 0
                      ? packPrice / packSize
                      : fallback
                    : unitPrice > 0
                      ? unitPrice
                      : fallback;

                return (
                  <div
                    key={product._id}
                    className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {product.name}
                    </p>

                    {packConfigured && (
                      <div className="mt-2 flex gap-1">
                        {(["pack", "unit"] as const).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              setInputModeByProduct((prev) => ({
                                ...prev,
                                [product._id]: option,
                              }))
                            }
                            className={cn(
                              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                              mode === option
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300",
                            )}
                          >
                            {option === "pack"
                              ? translate("kasirReceiptModePack").replace(
                                  "{unit}",
                                  purchaseUnit,
                                )
                              : translate("kasirReceiptModeUnit").replace(
                                  "{unit}",
                                  product.unit,
                                )}
                          </button>
                        ))}
                      </div>
                    )}

                    {packConfigured && mode === "pack" && (
                      <p className="mt-2 text-[11px] text-slate-500">
                        {translate("kasirPackSizeInfo")
                          .replace("{purchaseUnit}", purchaseUnit)
                          .replace("{count}", String(packSize))
                          .replace("{unit}", product.unit)}
                      </p>
                    )}

                    {packConfigured && mode === "pack" ? (
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
                          step={1}
                        />
                        <InputNumber
                          label={translate("kasirReceiptPricePerPack").replace(
                            "{unit}",
                            purchaseUnit,
                          )}
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
                    ) : (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <InputNumber
                          label={translate("kasirQty")}
                          value={qtyByProduct[product._id] ?? ""}
                          onChange={(v) =>
                            setQtyByProduct((prev) => ({
                              ...prev,
                              [product._id]: v,
                            }))
                          }
                          min={0}
                        />
                        <InputNumber
                          label={translate("kasirReceiptPricePerUnit").replace(
                            "{unit}",
                            product.unit,
                          )}
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

                    {stockQty > 0 && (
                      <div className="mt-2 space-y-0.5 text-xs text-slate-500">
                        <p>
                          {translate("kasirReceiptStockPreview")
                            .replace("{qty}", String(stockQty))
                            .replace("{unit}", product.unit)}
                        </p>
                        {effectiveUnitCost != null && effectiveUnitCost > 0 && (
                          <p>
                            {packPrice <= 0 && unitPrice <= 0
                              ? translate("kasirReceiptEstimatedCost")
                                  .replace(
                                    "{price}",
                                    formatRupiah(effectiveUnitCost),
                                  )
                                  .replace("{unit}", product.unit)
                              : translate("kasirPackPreview")
                                  .replace("{totalQty}", String(stockQty))
                                  .replace("{unit}", product.unit)
                                  .replace(
                                    "{unitCost}",
                                    formatRupiah(effectiveUnitCost),
                                  )}
                          </p>
                        )}
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
