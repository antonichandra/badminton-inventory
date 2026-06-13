import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { BottomSheet } from "../../core/components/ui/BottomSheet";
import { InputNumber } from "../../core/components/forms/InputNumber";
import { useLanguage } from "../../core/context/LanguageContext";
import { useToast } from "../../core/context/ToastContext";
import { formatRupiah } from "./utils";

export interface PayLinesSheetHandle {
  submit: () => void;
  canPay: boolean;
  isSaving: boolean;
}

interface PayLinesSheetProps {
  open: boolean;
  onClose: () => void;
  sessionToken: string;
  lineIds: Id<"saleLines">[];
  total: number;
  onCanPayChange?: (canPay: boolean) => void;
  onSavingChange?: (isSaving: boolean) => void;
  onSuccess: (result: {
    paymentBatchId: string;
    total: number;
    changeAmount: number;
    paymentMethod: "CASH" | "QRIS";
  }) => void;
}

export const PayLinesSheet = forwardRef<PayLinesSheetHandle, PayLinesSheetProps>(
  function PayLinesSheet(
    {
      open,
      onClose,
      sessionToken,
      lineIds,
      total,
      onCanPayChange,
      onSavingChange,
      onSuccess,
    },
    ref,
  ) {
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const paySaleLines = useMutation(api.shifts.paySaleLines);

    const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QRIS">("CASH");
    const [amountReceived, setAmountReceived] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const received = Number(amountReceived) || 0;
    const change = received - total;
    const canPay =
      lineIds.length > 0 &&
      !isSaving &&
      (paymentMethod === "QRIS" || received >= total);

    useEffect(() => {
      onCanPayChange?.(canPay);
    }, [canPay, onCanPayChange]);

    useEffect(() => {
      onSavingChange?.(isSaving);
    }, [isSaving, onSavingChange]);

    useEffect(() => {
      if (!open) {
        setPaymentMethod("CASH");
        setAmountReceived("");
      }
    }, [open]);

    const handlePay = useCallback(async () => {
      if (lineIds.length === 0) return;
      if (paymentMethod === "CASH" && received < total) return;

      setIsSaving(true);
      try {
        const result = await paySaleLines({
          sessionToken,
          lineIds,
          paymentMethod,
          amountReceived: paymentMethod === "CASH" ? received : undefined,
        });
        onSuccess({
          paymentBatchId: result.paymentBatchId,
          total: result.total,
          changeAmount: result.changeAmount,
          paymentMethod,
        });
        onClose();
        setAmountReceived("");
      } catch (error) {
        console.error(error);
        showToast({ type: "error", message: translate("unexpectedError") });
      } finally {
        setIsSaving(false);
      }
    }, [
      lineIds,
      onClose,
      onSuccess,
      paySaleLines,
      paymentMethod,
      received,
      sessionToken,
      showToast,
      total,
      translate,
    ]);

    useImperativeHandle(
      ref,
      () => ({ submit: () => void handlePay(), canPay, isSaving }),
      [canPay, handlePay, isSaving],
    );

    const methodButtons = useMemo(
      () => (
        <div className="grid grid-cols-2 gap-2">
          {(["CASH", "QRIS"] as const).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setPaymentMethod(method)}
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                paymentMethod === method
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                  : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400"
              }`}
            >
              {method === "CASH"
                ? translate("kasirCash")
                : translate("kasirQris")}
            </button>
          ))}
        </div>
      ),
      [paymentMethod, translate],
    );

    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={translate("kasirPay")}
        bottomInset="5.75rem"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">{translate("kasirSelectLines")}</p>

          <p className="text-sm text-slate-600 dark:text-slate-300">
            {lineIds.length} item · {translate("kasirPayTotal")}:{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {formatRupiah(total)}
            </span>
          </p>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              {translate("kasirSelectPayment")}
            </p>
            {methodButtons}
          </div>

          {paymentMethod === "CASH" && (
            <>
              <InputNumber
                label={translate("kasirAmountReceived")}
                value={amountReceived}
                onChange={setAmountReceived}
                min={0}
                format="currency"
                required
              />
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <span className="text-sm text-slate-500">
                  {translate("kasirChange")}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    change < 0
                      ? "text-red-600"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {formatRupiah(Math.max(0, change))}
                </span>
              </div>
            </>
          )}
        </div>
      </BottomSheet>
    );
  },
);
