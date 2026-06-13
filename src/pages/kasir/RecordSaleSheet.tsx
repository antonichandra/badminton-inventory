import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { BottomSheet } from "../../core/components/ui/BottomSheet";
import { Button } from "../../core/components/ui/Button";
import { Dropdown } from "../../core/components/forms/Dropdown";
import { InputNumber } from "../../core/components/forms/InputNumber";
import { InputText } from "../../core/components/forms/InputText";
import { Textarea } from "../../core/components/forms/Textarea";
import { useLanguage } from "../../core/context/LanguageContext";
import { useToast } from "../../core/context/ToastContext";
import { formatRupiah, parseGroupLabel } from "./utils";

interface RecordSaleSheetProps {
  open: boolean;
  onClose: () => void;
  sessionToken: string;
  businessId: Id<"businesses">;
  defaultGroupLabel?: string;
}

export function RecordSaleSheet({
  open,
  onClose,
  sessionToken,
  businessId,
  defaultGroupLabel,
}: RecordSaleSheetProps) {
  const { translate } = useLanguage();
  const { showToast } = useToast();
  const addSaleLine = useMutation(api.shifts.addSaleLine);

  const products = useQuery(api.products.listActiveProductsForKasir, {
    sessionToken,
    businessId,
  });

  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [hours, setHours] = useState("1");
  const [rentalDescription, setRentalDescription] = useState("");
  const [groupLabel, setGroupLabel] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const productOptions = useMemo(
    () =>
      (products ?? []).map((product) => ({
        value: product._id,
        label: product.name,
      })),
    [products],
  );

  const selectedProduct = useMemo(
    () => (products ?? []).find((product) => product._id === productId),
    [products, productId],
  );

  useEffect(() => {
    if (!open) return;
    setGroupLabel(defaultGroupLabel ?? "");
    setCustomerNote("");
    setQty("1");
    setHours("1");
    setRentalDescription("");
    if (productOptions.length > 0 && !productId) {
      setProductId(productOptions[0].value);
    }
  }, [open, defaultGroupLabel, productOptions, productId]);

  const previewTotal = useMemo(() => {
    if (!selectedProduct) return 0;
    if (selectedProduct.type === "RENTAL") {
      return (
        (selectedProduct.rentalPricePerHour ?? 0) *
        (Number(qty) || 0) *
        (Number(hours) || 0)
      );
    }
    return selectedProduct.sellPrice * (Number(qty) || 0);
  }, [selectedProduct, qty, hours]);

  const handleSubmit = async () => {
    if (!productId || !selectedProduct) return;

    setIsSaving(true);
    try {
      await addSaleLine({
        sessionToken,
        productId: productId as Id<"products">,
        qty: Number(qty) || 1,
        rentalHours:
          selectedProduct.type === "RENTAL" ? Number(hours) || 0 : undefined,
        rentalDescription:
          selectedProduct.type === "RENTAL" ? rentalDescription : undefined,
        groupLabel: parseGroupLabel(groupLabel),
        customerNote: customerNote || undefined,
      });
      showToast({
        type: "success",
        message: translate("kasirRecordSuccess"),
      });
      onClose();
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: translate("unexpectedError") });
    } finally {
      setIsSaving(false);
    }
  };

  const isRental = selectedProduct?.type === "RENTAL";
  const canSubmit =
    !!productId &&
    (isRental
      ? Number(qty) > 0 &&
        Number(hours) > 0 &&
        rentalDescription.trim().length > 0
      : Number(qty) > 0);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={translate("kasirRecord")}
      footer={
        <Button
          className="w-full"
          onClick={handleSubmit}
          loading={isSaving}
          disabled={!canSubmit || isSaving}
        >
          {translate("kasirRecord")} · {formatRupiah(previewTotal)}
        </Button>
      }
    >
      <div className="space-y-4">
        <Dropdown
          label={translate("kasirSelectProduct")}
          value={productId}
          onChange={setProductId}
          options={productOptions}
          searchable
          required
          emptyMessage={translate("kasirNoProducts")}
        />

        {isRental ? (
          <>
            <InputNumber
              label={translate("kasirQty")}
              value={qty}
              onChange={setQty}
              min={1}
              required
            />
            <InputNumber
              label={translate("kasirHours")}
              value={hours}
              onChange={setHours}
              min={0.5}
              step={0.5}
              required
            />
            <Textarea
              label={translate("kasirRentalDesc")}
              value={rentalDescription}
              onChange={setRentalDescription}
              required
            />
          </>
        ) : (
          <InputNumber
            label={translate("kasirQty")}
            value={qty}
            onChange={setQty}
            min={1}
            required
          />
        )}

        <InputText
          label={translate("kasirGroup")}
          value={groupLabel}
          onChange={setGroupLabel}
          placeholder={translate("kasirNewGroup")}
        />
        <InputText
          label={translate("kasirNote")}
          value={customerNote}
          onChange={setCustomerNote}
        />
      </div>
    </BottomSheet>
  );
}
