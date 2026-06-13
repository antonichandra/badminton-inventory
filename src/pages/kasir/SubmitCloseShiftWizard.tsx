import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { InputNumber } from "../../core/components/forms/InputNumber";
import { Button } from "../../core/components/ui/Button";
import { useLanguage } from "../../core/context/LanguageContext";
import { useToast } from "../../core/context/ToastContext";
import { formatRupiah } from "./utils";

interface SubmitCloseShiftWizardProps {
  sessionToken: string;
  onCancel: () => void;
  onComplete: () => void;
}

export function SubmitCloseShiftWizard({
  sessionToken,
  onCancel,
  onComplete,
}: SubmitCloseShiftWizardProps) {
  const { translate } = useLanguage();
  const { showToast } = useToast();
  const submitClose = useMutation(api.shifts.submitShiftCloseRequest);

  const stockContext = useQuery(api.shifts.getShiftStockContext, {
    sessionToken,
  });

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [closingStock, setClosingStock] = useState<Record<string, string>>({});
  const [reportedCash, setReportedCash] = useState("0");
  const [isSaving, setIsSaving] = useState(false);

  const stockRows = useMemo(() => {
    return (stockContext ?? []).map((item) => {
      const closingQty = Number(closingStock[item.productId] ?? "0") || 0;
      const soldQty =
        item.openingQty + item.receivedQty - closingQty - item.writeOffQty;
      return { ...item, closingQty, soldQty };
    });
  }, [stockContext, closingStock]);

  const closingStockPayload = useMemo(
    () =>
      stockRows.map((row) => ({
        productId: row.productId,
        qty: row.closingQty,
      })),
    [stockRows],
  );

  const preview = useQuery(
    api.shifts.getShiftClosePreview,
    step >= 2
      ? {
          sessionToken,
          reportedCash: Number(reportedCash) || 0,
          closingStock: closingStockPayload,
        }
      : "skip",
  );

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await submitClose({
        sessionToken,
        reportedCash: Number(reportedCash) || 0,
        closingStock: closingStockPayload,
      });
      showToast({
        type: "success",
        message: translate("kasirCloseRequestSubmitted"),
      });
      onComplete();
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: translate("unexpectedError") });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
        {translate("kasirSubmitCloseTitle")}
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {translate("kasirSubmitCloseDesc")}
      </p>

      {step === 1 && (
        <div className="mt-6 space-y-4">
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2">Produk</th>
                  <th className="px-3 py-2">{translate("kasirClosingStock")}</th>
                  <th className="px-3 py-2">{translate("kasirSoldQty")}</th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map((row) => (
                  <tr
                    key={row.productId}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="px-3 py-2">{row.productName}</td>
                    <td className="px-3 py-2">
                      <InputNumber
                        variant="inline"
                        value={closingStock[row.productId] ?? "0"}
                        onChange={(value) =>
                          setClosingStock((prev) => ({
                            ...prev,
                            [row.productId]: value,
                          }))
                        }
                        min={0}
                      />
                    </td>
                    <td className="px-3 py-2">{row.soldQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={onCancel}>
              {translate("cancel")}
            </Button>
            <Button onClick={() => setStep(2)}>{translate("kasirContinue")}</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 space-y-4">
          <InputNumber
            label={translate("kasirClosingCash")}
            value={reportedCash}
            onChange={setReportedCash}
            min={0}
            format="currency"
            required
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {translate("kasirSubmitCloseCashHint")}
          </p>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              {translate("cancel")}
            </Button>
            <Button onClick={() => setStep(3)}>{translate("kasirContinue")}</Button>
          </div>
        </div>
      )}

      {step === 3 && preview && (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              {translate("kasirSalesGapTitle")}
            </p>
            <p className="mt-1 text-amber-800 dark:text-amber-300">
              {translate("kasirOverInput")}: {preview.overInputQtyTotal}{" "}
              {translate("kasirUnits")} · {translate("kasirMissInput")}:{" "}
              {preview.missInputQtyTotal} {translate("kasirUnits")}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-700">
            <p>
              {translate("kasirTotalSales")}:{" "}
              {formatRupiah(preview.cashSummary.totalSales)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {translate("kasirSalesInfoNote")}
            </p>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              {translate("cancel")}
            </Button>
            <Button variant="danger" onClick={handleSubmit} loading={isSaving}>
              {translate("kasirSubmitCloseConfirm")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
