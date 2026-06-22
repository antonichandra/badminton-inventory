import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Dropdown } from "../../../core/components/forms/Dropdown";
import { InputNumber } from "../../../core/components/forms/InputNumber";
import { InputText } from "../../../core/components/forms/InputText";
import { Modal } from "../../../core/components/ui/Modal";
import { Button } from "../../../core/components/ui/Button";
import { useLanguage } from "../../../core/context/LanguageContext";
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

  const [name, setName] = useState("");
  const [type, setType] = useState<"RETAIL" | "RENTAL">("RETAIL");
  const [sellPrice, setSellPrice] = useState("0");
  const [rentalPrice, setRentalPrice] = useState("0");
  const [unit, setUnit] = useState("pcs");
  const [trackExpiry, setTrackExpiry] = useState(false);
  const [defaultUnitCost, setDefaultUnitCost] = useState("0");
  const [unitsPerPurchaseUnit, setUnitsPerPurchaseUnit] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (product) {
      setName(product.name);
      setType(product.type);
      setSellPrice(String(product.sellPrice));
      setRentalPrice(String(product.rentalPricePerHour ?? 0));
      setUnit(product.unit);
      setTrackExpiry(product.trackExpiry ?? false);
      setDefaultUnitCost(String(product.defaultUnitCost ?? 0));
      setUnitsPerPurchaseUnit(
        product.unitsPerPurchaseUnit != null
          ? String(product.unitsPerPurchaseUnit)
          : "",
      );
      setIsActive(product.isActive);
    } else {
      setName("");
      setType("RETAIL");
      setSellPrice("0");
      setRentalPrice("0");
      setUnit("pcs");
      setTrackExpiry(false);
      setDefaultUnitCost("0");
      setUnitsPerPurchaseUnit("");
      setIsActive(true);
    }
    setError(null);
  }, [open, product]);

  const handleSubmit = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const packSize = unitsPerPurchaseUnit.trim()
        ? Number(unitsPerPurchaseUnit)
        : undefined;

      const payload = {
        sessionToken,
        name,
        type,
        sellPrice: Number(sellPrice) || 0,
        rentalPricePerHour: Number(rentalPrice) || 0,
        unit: type === "RENTAL" ? "jam" : unit,
        trackExpiry: type === "RETAIL" ? trackExpiry : false,
        defaultUnitCost:
          type === "RETAIL" ? Number(defaultUnitCost) || 0 : undefined,
        unitsPerPurchaseUnit: type === "RETAIL" ? packSize : undefined,
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
            <InputNumber
              label={translate("productDefaultUnitCost")}
              value={defaultUnitCost}
              onChange={setDefaultUnitCost}
              min={0}
              format="currency"
              required
            />
            <InputNumber
              label={translate("productUnitsPerPurchaseUnit")}
              value={unitsPerPurchaseUnit}
              onChange={setUnitsPerPurchaseUnit}
              min={1}
              placeholder="12"
            />
            <InputText
              label={translate("productUnit")}
              value={unit}
              onChange={setUnit}
              required
            />
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
