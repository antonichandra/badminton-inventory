import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { InputNumber } from "../../core/components/forms/InputNumber";
import { Button } from "../../core/components/ui/Button";
import { ConfirmModal } from "../../core/components/ui/ConfirmModal";
import { useLanguage } from "../../core/context/LanguageContext";
import { useToast } from "../../core/context/ToastContext";
import { ShiftCashBreakdown } from "./ShiftCashBreakdown";
import { SalesByTierTabs } from "./SalesByTierTabs";
import { formatRupiah } from "./utils";

interface CloseShiftWizardProps {
  sessionToken: string;
  onComplete: (shiftId: Id<"shifts">) => void;
  onCancel: () => void;
}

export function CloseShiftWizard({
  sessionToken,
  onComplete,
  onCancel,
}: CloseShiftWizardProps) {
  const { translate } = useLanguage();
  const { showToast } = useToast();
  const closeShift = useMutation(api.shifts.closeShift);

  const stockContext = useQuery(api.shifts.getShiftStockContext, {
    sessionToken,
  });
  const cashPreview = useQuery(api.shifts.getShiftCashPreview, {
    sessionToken,
  });
  const liveStats = useQuery(api.shifts.getShiftLiveStats, { sessionToken });

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [closingStock, setClosingStock] = useState<Record<string, string>>({});
  const [closingCash, setClosingCash] = useState("0");
  const [closingQris, setClosingQris] = useState("0");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const stockRows = useMemo(() => {
    return (stockContext ?? []).map((item) => {
      const closingQty = Number(closingStock[item.productId] ?? "0") || 0;
      const soldQty =
        item.openingQty + item.receivedQty - closingQty - item.writeOffQty;
      return {
        ...item,
        closingQty,
        soldQty,
      };
    });
  }, [stockContext, closingStock]);

  const cashSummary = useMemo(() => {
    if (!cashPreview) return null;
    const actualCash = Number(closingCash) || 0;
    const actualQris = Number(closingQris) || 0;
    const totalSales = cashPreview.totalSales ?? 0;
    const expectedCashInDrawer =
      cashPreview.openingCash +
      totalSales -
      actualQris -
      cashPreview.expenses -
      cashPreview.deposits;
    const totalExpected =
      cashPreview.openingCash + totalSales - cashPreview.expenses - cashPreview.deposits;
    return {
      totalSales,
      expectedCashInDrawer,
      actualCash,
      actualQris,
      actualTotal: actualCash + actualQris,
      totalVariance: actualCash + actualQris - totalExpected,
      cashVariance: actualCash - expectedCashInDrawer,
      expenses: cashPreview.expenses,
      deposits: cashPreview.deposits,
      recordedCashSales: cashPreview.recordedCashSales,
      recordedQrisSales: cashPreview.recordedQrisSales,
      openingCash: cashPreview.openingCash,
    };
  }, [cashPreview, closingCash, closingQris]);

  const totalRevenue = liveStats?.paidRevenue ?? 0;

  const handleClose = async () => {
    setIsSaving(true);
    try {
      const result = await closeShift({
        sessionToken,
        closingCash: Number(closingCash) || 0,
        closingQris: Number(closingQris) || 0,
        closingStock: stockRows.map((row) => ({
          productId: row.productId,
          qty: row.closingQty,
        })),
      });
      showToast({
        type: "success",
        message: translate("kasirShiftClosed"),
      });
      onComplete(result.shiftId);
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: translate("unexpectedError") });
    } finally {
      setIsSaving(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
        {translate("kasirCloseShiftTitle")}
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {translate("kasirCloseShiftDesc")}
      </p>

      {step === 1 && (
        <div className="mt-6 space-y-4">
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2">Produk</th>
                  <th className="px-3 py-2">{translate("kasirClosingStock")}</th>
                  <th className="px-3 py-2">{translate("kasirReceived")}</th>
                  <th className="px-3 py-2">{translate("kasirSoldQty")}</th>
                  <th className="px-3 py-2">{translate("kasirWriteOff")}</th>
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
                    <td className="px-3 py-2">{row.receivedQty}</td>
                    <td className="px-3 py-2">{row.soldQty}</td>
                    <td className="px-3 py-2">{row.writeOffQty}</td>
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

      {step === 2 && cashSummary && (
        <div className="mt-6 space-y-4">
          <InputNumber
            label={translate("kasirClosingCash")}
            value={closingCash}
            onChange={setClosingCash}
            min={0}
            format="currency"
            required
          />
          <InputNumber
            label={translate("kasirClosingQris")}
            value={closingQris}
            onChange={setClosingQris}
            min={0}
            format="currency"
            required
          />

          <div className="rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800">
            <p>
              {translate("kasirTotalSales")}: {formatRupiah(cashSummary.totalSales)}
            </p>
            <p className="text-xs text-slate-500">
              {translate("kasirCash")}: {formatRupiah(cashSummary.recordedCashSales)}{" "}
              · {translate("kasirQris")}: {formatRupiah(cashSummary.recordedQrisSales)}
            </p>
            <p>
              {translate("kasirCashExpense")}:{" "}
              {formatRupiah(cashSummary.expenses)}
            </p>
            <p>
              {translate("kasirCashDeposit")}:{" "}
              {formatRupiah(cashSummary.deposits)}
            </p>
            <p className="text-xs text-slate-500">{translate("kasirSalesInfoNote")}</p>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              {translate("cancel")}
            </Button>
            <Button onClick={() => setStep(3)}>{translate("kasirContinue")}</Button>
          </div>
        </div>
      )}

      {step === 3 && cashSummary && (
        <div className="mt-6 space-y-4">
          <h3 className="font-medium text-slate-900 dark:text-white">
            {translate("kasirSummary")}
          </h3>

          <SalesByTierTabs tiers={liveStats?.salesByPriceTier ?? []} />

          <ShiftCashBreakdown
            openingCash={cashSummary.openingCash}
            totalSales={cashSummary.totalSales}
            verifiedQris={cashSummary.actualQris}
            expenses={cashSummary.expenses}
            deposits={cashSummary.deposits}
            expectedCashInDrawer={cashSummary.expectedCashInDrawer}
            reportedCash={cashSummary.actualCash}
            cashVariance={cashSummary.cashVariance}
            totalRevenue={totalRevenue}
            totalCogs={liveStats?.totalCogs}
            grossProfit={liveStats?.grossProfit}
            compact
          />

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              {translate("cancel")}
            </Button>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              {translate("kasirConfirmClose")}
            </Button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={translate("kasirCloseShiftTitle")}
        description={translate("kasirCloseShiftDesc")}
        confirmLabel={translate("kasirConfirmClose")}
        cancelLabel={translate("cancel")}
        confirmVariant="danger"
        loading={isSaving}
        onConfirm={handleClose}
      />
    </div>
  );
}
