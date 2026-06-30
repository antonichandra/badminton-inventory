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
import { CloseShiftStockPreview } from "./CloseShiftStockPreview";
import { GroupedStockTable, GroupedStockTd, GroupedStockTh } from "./GroupedStockTable";
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

  const closingStockPayload = useMemo(
    () =>
      stockRows.map((row) => ({
        productId: row.productId,
        qty: row.closingQty,
      })),
    [stockRows],
  );

  const closePreview = useQuery(
    api.shifts.getShiftClosePreview,
    step >= 3
      ? {
          sessionToken,
          reportedCash: Number(closingCash) || 0,
          verifiedQris: Number(closingQris) || 0,
          closingStock: closingStockPayload,
        }
      : "skip",
  );

  const cashSummary = useMemo(() => {
    if (!cashPreview) return null;
    const actualCash = Number(closingCash) || 0;
    const actualQris = Number(closingQris) || 0;
    const totalSales = cashPreview.totalSales ?? 0;
    const cashIncome = cashPreview.cashIncome ?? 0;
    const expectedCashInDrawer =
      cashPreview.openingCash +
      totalSales +
      cashIncome -
      actualQris -
      cashPreview.expenses -
      cashPreview.deposits;
    const totalExpected =
      cashPreview.openingCash +
      totalSales +
      cashIncome -
      cashPreview.expenses -
      cashPreview.deposits;
    return {
      totalSales,
      cashIncome,
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

  const step3Cash = closePreview?.cashSummary ?? null;

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
          <GroupedStockTable
            rows={stockRows}
            itemCountLabel={(count) =>
              translate("categoryItemCount").replace("{count}", String(count))
            }
            headers={
              <tr>
                <GroupedStockTh>Produk</GroupedStockTh>
                <GroupedStockTh>{translate("kasirClosingStock")}</GroupedStockTh>
                <GroupedStockTh>{translate("kasirReceived")}</GroupedStockTh>
                <GroupedStockTh>{translate("kasirSoldQty")}</GroupedStockTh>
                <GroupedStockTh>{translate("kasirWriteOff")}</GroupedStockTh>
              </tr>
            }
            renderRow={(row) => (
              <>
                <GroupedStockTd className="font-medium text-slate-900 dark:text-white">
                  {row.productName}
                </GroupedStockTd>
                <GroupedStockTd>
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
                </GroupedStockTd>
                <GroupedStockTd className="tabular-nums">
                  {row.receivedQty}
                </GroupedStockTd>
                <GroupedStockTd className="tabular-nums">{row.soldQty}</GroupedStockTd>
                <GroupedStockTd className="tabular-nums">
                  {row.writeOffQty}
                </GroupedStockTd>
              </>
            )}
          />
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
              {translate("kasirCashIncome")}:{" "}
              {formatRupiah(cashSummary.cashIncome)}
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

          {closePreview ? (
            <>
              {(closePreview.overInputQtyTotal > 0 ||
                closePreview.missInputQtyTotal > 0) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    {translate("kasirSalesGapTitle")}
                  </p>
                  <p className="mt-1 text-amber-800 dark:text-amber-300">
                    {translate("kasirOverInput")}: {closePreview.overInputQtyTotal}{" "}
                    {translate("kasirUnits")} · {translate("kasirMissInput")}:{" "}
                    {closePreview.missInputQtyTotal} {translate("kasirUnits")}
                  </p>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-medium uppercase text-slate-500">
                  {translate("kasirTabStock")}
                </p>
                <CloseShiftStockPreview rows={closePreview.stockPreview} />
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">{translate("loading")}</p>
          )}

          {step3Cash && (
            <ShiftCashBreakdown
              openingCash={step3Cash.openingCash}
              totalSales={step3Cash.totalSales}
              cashIncome={step3Cash.cashIncome}
              verifiedQris={step3Cash.verifiedQris}
              recordedQrisSales={step3Cash.recordedQrisSales}
              expenses={step3Cash.expenses}
              deposits={step3Cash.deposits}
              expectedCashInDrawer={step3Cash.expectedCashInDrawer}
              reportedCash={step3Cash.reportedCash}
              cashVariance={step3Cash.cashVariance}
              totalRevenue={closePreview?.totalRevenue}
              recordedRevenue={closePreview?.recordedRevenue}
              impliedRevenue={closePreview?.impliedRevenue}
              overInputQtyTotal={closePreview?.overInputQtyTotal}
              missInputQtyTotal={closePreview?.missInputQtyTotal}
              showRevenueBreakdown={
                (closePreview?.impliedRevenue ?? 0) > 0
              }
              compact
            />
          )}

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
