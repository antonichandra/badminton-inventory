import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { BottomSheet } from "../../core/components/ui/BottomSheet";
import { Button } from "../../core/components/ui/Button";
import { Dropdown } from "../../core/components/forms/Dropdown";
import { InputNumber } from "../../core/components/forms/InputNumber";
import { Textarea } from "../../core/components/forms/Textarea";
import { useLanguage } from "../../core/context/LanguageContext";
import { useToast } from "../../core/context/ToastContext";

interface StockWriteOffSheetProps {
  open: boolean;
  onClose: () => void;
  sessionToken: string;
  businessId: Id<"businesses">;
  onBack?: () => void;
}

export function StockWriteOffSheet({
  open,
  onClose,
  sessionToken,
  businessId,
  onBack,
}: StockWriteOffSheetProps) {
  const { translate } = useLanguage();
  const { showToast } = useToast();
  const addStockWriteOff = useMutation(api.shifts.addStockWriteOff);

  const products = useQuery(api.products.listRetailProductsForShift, {
    sessionToken,
    businessId,
  });

  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const productOptions = useMemo(
    () =>
      (products ?? []).map((product) => ({
        value: product._id,
        label: product.name,
      })),
    [products],
  );

  const handleSubmit = async () => {
    if (!productId) return;

    setIsSaving(true);
    try {
      await addStockWriteOff({
        sessionToken,
        productId: productId as Id<"products">,
        qty: Number(qty) || 0,
        note,
      });
      showToast({
        type: "success",
        message: translate("kasirActionSuccess"),
      });
      onClose();
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: translate("unexpectedError") });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={translate("kasirStockWriteOff")}
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
            disabled={
              isSaving || !productId || !note.trim() || Number(qty) <= 0
            }
          >
            {translate("kasirContinue")}
          </Button>
        </div>
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
        />
        <InputNumber
          label={translate("kasirQty")}
          value={qty}
          onChange={setQty}
          min={1}
          required
        />
        <Textarea
          label={translate("kasirWriteOffReason")}
          value={note}
          onChange={setNote}
          required
        />
      </div>
    </BottomSheet>
  );
}
