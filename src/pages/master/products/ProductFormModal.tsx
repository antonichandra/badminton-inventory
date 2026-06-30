import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Dropdown } from "../../../core/components/forms/Dropdown";
import { InputNumber } from "../../../core/components/forms/InputNumber";
import { InputText } from "../../../core/components/forms/InputText";
import { Modal } from "../../../core/components/ui/Modal";
import { Button } from "../../../core/components/ui/Button";
import { useLanguage } from "../../../core/context/LanguageContext";
import { formatRupiah } from "../../kasir/utils";
import type { ProductRow } from "./products.config";

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  sessionToken: string;
  product?: ProductRow | null;
  onSuccess: () => void;
}

export function ProductFormModal({
  open,
  onClose,
  sessionToken,
  product,
  onSuccess,
}: ProductFormModalProps) {
  const { translate } = useLanguage();
  const createProduct = useMutation(api.products.createProduct);
  const updateProduct = useMutation(api.products.updateProduct);
  const categoryOptions = useQuery(api.productCategories.listCategoryOptions, {
    sessionToken,
  });

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState<"RETAIL" | "RENTAL">("RETAIL");
  const [sellPrice, setSellPrice] = useState("0");
  const [rentalPrice, setRentalPrice] = useState("0");
  const [unit, setUnit] = useState("pcs");
  const [purchaseUnit, setPurchaseUnit] = useState("");
  const [trackExpiry, setTrackExpiry] = useState(false);
  const [defaultUnitCost, setDefaultUnitCost] = useState("0");
  const [defaultPackCost, setDefaultPackCost] = useState("0");
  const [unitsPerPurchaseUnit, setUnitsPerPurchaseUnit] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const packSize = useMemo(() => {
    const parsed = Number(unitsPerPurchaseUnit);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : 0;
  }, [unitsPerPurchaseUnit]);

  const hasPackConfig =
    packSize >= 1 && purchaseUnit.trim().length > 0;

  const unitCostPreview = useMemo(() => {
    if (!hasPackConfig) {
      return Number(defaultUnitCost) || 0;
    }
    const packCost = Number(defaultPackCost) || 0;
    if (packCost <= 0) return 0;
    return Math.round(packCost / packSize);
  }, [defaultPackCost, defaultUnitCost, hasPackConfig, packSize]);

  useEffect(() => {
    if (!open) return;

    if (product) {
      setName(product.name);
      setType(product.type);
      setSellPrice(String(product.sellPrice));
      setRentalPrice(String(product.rentalPricePerHour ?? 0));
      setUnit(product.unit);
      setPurchaseUnit(product.purchaseUnit ?? "");
      setTrackExpiry(product.trackExpiry ?? false);
      const pack =
        product.unitsPerPurchaseUnit != null &&
        product.unitsPerPurchaseUnit >= 1;
      const unitCost = product.defaultUnitCost ?? 0;
      if (pack && product.purchaseUnit) {
        setDefaultPackCost(String(unitCost * product.unitsPerPurchaseUnit!));
        setDefaultUnitCost("0");
      } else {
        setDefaultUnitCost(String(unitCost));
        setDefaultPackCost("0");
      }
      setUnitsPerPurchaseUnit(
        product.unitsPerPurchaseUnit != null
          ? String(product.unitsPerPurchaseUnit)
          : "",
      );
      setIsActive(product.isActive);
      setCategoryId(product.categoryId ?? "");
    } else {
      setName("");
      setType("RETAIL");
      setSellPrice("0");
      setRentalPrice("0");
      setUnit("pcs");
      setPurchaseUnit("");
      setTrackExpiry(false);
      setDefaultUnitCost("0");
      setDefaultPackCost("0");
      setUnitsPerPurchaseUnit("");
      setIsActive(true);
      setCategoryId("");
    }
    setError(null);
  }, [open, product]);

  const handleSubmit = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const packSizeValue = unitsPerPurchaseUnit.trim()
        ? Number(unitsPerPurchaseUnit)
        : undefined;
      const purchaseUnitValue = purchaseUnit.trim() || undefined;

      const resolvedUnitCost =
        type === "RETAIL"
          ? hasPackConfig
            ? unitCostPreview
            : Number(defaultUnitCost) || 0
          : undefined;

      const payload = {
        sessionToken,
        name,
        type,
        sellPrice: Number(sellPrice) || 0,
        rentalPricePerHour: Number(rentalPrice) || 0,
        unit: type === "RENTAL" ? "jam" : unit,
        trackExpiry: type === "RETAIL" ? trackExpiry : false,
        defaultUnitCost: resolvedUnitCost,
        unitsPerPurchaseUnit:
          type === "RETAIL" ? packSizeValue : undefined,
        purchaseUnit: type === "RETAIL" ? purchaseUnitValue : undefined,
        categoryId: categoryId
          ? (categoryId as Id<"productCategories">)
          : undefined,
      };

      if (product) {
        await updateProduct({
          ...payload,
          productId: product._id as Id<"products">,
          isActive,
        });
      } else {
        await createProduct(payload);
      }

      onSuccess();
      onClose();
    } catch (submitError) {
      console.error(submitError);
      setError(translate("unexpectedError"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? translate("productEdit") : translate("productAdd")}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            {translate("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            loading={isSaving}
            disabled={isSaving || !name.trim()}
          >
            {translate("productSave")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <InputText
          label={translate("productColName")}
          value={name}
          onChange={setName}
          required
        />

        <Dropdown
          label={translate("productCategory")}
          value={categoryId}
          onChange={setCategoryId}
          options={[
            { value: "", label: translate("productCategoryNone") },
            ...(categoryOptions ?? []).map((option: { value: string; label: string }) => ({
              value: option.value,
              label: option.label,
            })),
          ]}
          placeholder={translate("productCategoryPlaceholder")}
        />

        {(categoryOptions?.length ?? 0) === 0 && (
          <p className="text-xs text-slate-500">
            {translate("productCategoryHint")}{" "}
            <Link
              to="/master/kategori-produk"
              className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              {translate("menuKategoriProduk")}
            </Link>
          </p>
        )}

        <Dropdown
          label={translate("productColType")}
          value={type}
          onChange={(value) => setType(value as "RETAIL" | "RENTAL")}
          options={[
            { value: "RETAIL", label: translate("productTypeRetail") },
            { value: "RENTAL", label: translate("productTypeRental") },
          ]}
          disabled={!!product}
        />

        {type === "RETAIL" ? (
          <>
            <InputNumber
              label={translate("productSellPrice")}
              value={sellPrice}
              onChange={setSellPrice}
              min={0}
              format="currency"
              required
            />
            <InputText
              label={translate("productSellUnit")}
              value={unit}
              onChange={setUnit}
              required
            />
            <InputText
              label={translate("productPurchaseUnit")}
              value={purchaseUnit}
              onChange={setPurchaseUnit}
              placeholder="dus"
            />
            <InputNumber
              label={translate("productUnitsPerPurchaseUnit")}
              value={unitsPerPurchaseUnit}
              onChange={setUnitsPerPurchaseUnit}
              min={1}
              step={1}
              placeholder="50"
            />
            {hasPackConfig ? (
              <>
                <InputNumber
                  label={translate("productDefaultPackCost")}
                  value={defaultPackCost}
                  onChange={setDefaultPackCost}
                  min={0}
                  format="currency"
                />
                {unitCostPreview > 0 && (
                  <p className="text-xs text-slate-500">
                    {translate("productDefaultUnitCostPreview")
                      .replace("{unit}", unit)
                      .replace("{price}", formatRupiah(unitCostPreview))}
                  </p>
                )}
              </>
            ) : (
              <InputNumber
                label={translate("productDefaultUnitCost")}
                value={defaultUnitCost}
                onChange={setDefaultUnitCost}
                min={0}
                format="currency"
              />
            )}
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={trackExpiry}
                onChange={(e) => setTrackExpiry(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              {translate("productTrackExpiry")}
            </label>
          </>
        ) : (
          <InputNumber
            label={translate("productRentalPrice")}
            value={rentalPrice}
            onChange={setRentalPrice}
            min={0}
            format="currency"
            required
          />
        )}

        {product && (
          <Dropdown
            label={translate("productColStatus")}
            value={isActive ? "active" : "inactive"}
            onChange={(value) => setIsActive(value === "active")}
            options={[
              { value: "active", label: translate("supplierActive") },
              { value: "inactive", label: translate("supplierInactive") },
            ]}
          />
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </Modal>
  );
}
