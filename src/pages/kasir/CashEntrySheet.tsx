import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BottomSheet } from "../../core/components/ui/BottomSheet";
import { Button } from "../../core/components/ui/Button";
import { InputNumber } from "../../core/components/forms/InputNumber";
import { Textarea } from "../../core/components/forms/Textarea";
import { useLanguage } from "../../core/context/LanguageContext";
import { useToast } from "../../core/context/ToastContext";

interface CashEntrySheetProps {
  open: boolean;
  onClose: () => void;
  sessionToken: string;
  type: "EXPENSE" | "DEPOSIT" | "INCOME";
  title: string;
  onBack?: () => void;
}

export function CashEntrySheet({
  open,
  onClose,
  sessionToken,
  type,
  title,
  onBack,
}: CashEntrySheetProps) {
  const { translate } = useLanguage();
  const { showToast } = useToast();
  const addCashEntry = useMutation(api.shifts.addCashEntry);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await addCashEntry({
        sessionToken,
        type,
        amount: Number(amount) || 0,
        note,
      });
      showToast({
        type: "success",
        message: translate("kasirActionSuccess"),
      });
      setAmount("");
      setNote("");
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
      title={title}
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
            disabled={isSaving || !note.trim() || Number(amount) <= 0}
          >
            {translate("kasirContinue")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <InputNumber
          label={translate("kasirPayTotal")}
          value={amount}
          onChange={setAmount}
          min={1}
          format="currency"
          required
        />
        <Textarea
          label={translate("kasirExpenseNote")}
          value={note}
          onChange={setNote}
          required
        />
      </div>
    </BottomSheet>
  );
}
