import { useMemo, useState } from "react";
import { InputNumber } from "../../core/components/forms/InputNumber";
import { PageHeader } from "../../core/components/PageHeader";
import { PermissionGuard } from "../../core/components/PermissionGuard";
import { useLanguage } from "../../core/context/LanguageContext";
import { computeShiftCashReconciliation } from "../../core/utils/shiftCashReconciliation";
import { formatRupiah } from "../kasir/utils";

function parseAmount(value: string): number {
  return Number(value.replace(/\D/g, "")) || 0;
}

function ResultRow({
  label,
  value,
  muted,
  bold,
  valueClass,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  valueClass?: string;
}) {
  return (
    <div
      className={`flex justify-between gap-4 ${muted ? "text-slate-500" : ""} ${bold ? "border-t border-slate-200 pt-1 font-medium text-slate-900 dark:border-slate-700 dark:text-white" : ""}`}
    >
      <span>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

function varianceClass(variance: number): string {
  if (variance < 0) return "font-semibold text-red-600";
  if (variance > 0) return "font-semibold text-emerald-600";
  return "font-semibold text-slate-700 dark:text-slate-200";
}

function varianceLabel(
  variance: number,
  translate: (key: "kasirStaffMinus" | "kasirStaffPlus" | "kasirStaffExact") => string,
): string {
  if (variance < 0) return translate("kasirStaffMinus");
  if (variance > 0) return translate("kasirStaffPlus");
  return translate("kasirStaffExact");
}

export function KalkulatorPage() {
  const { translate } = useLanguage();

  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("0");
  const [verifiedQris, setVerifiedQris] = useState("0");
  const [cashIncome, setCashIncome] = useState("0");
  const [expenses, setExpenses] = useState("0");
  const [retailRevenue, setRetailRevenue] = useState("0");
  const [rentalRevenue, setRentalRevenue] = useState("0");

  const result = useMemo(
    () =>
      computeShiftCashReconciliation({
        openingCash: parseAmount(openingCash),
        closingCash: parseAmount(closingCash),
        verifiedQris: parseAmount(verifiedQris),
        cashIncome: parseAmount(cashIncome),
        expenses: parseAmount(expenses),
        retailRevenue: parseAmount(retailRevenue),
        rentalRevenue: parseAmount(rentalRevenue),
      }),
    [
      openingCash,
      closingCash,
      verifiedQris,
      cashIncome,
      expenses,
      retailRevenue,
      rentalRevenue,
    ],
  );

  return (
    <PermissionGuard permission="kasir">
      <PageHeader
        title={translate("pageKalkulatorTitle")}
        subtitle={translate("pageKalkulatorSubtitle")}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
            {translate("calcInputTitle")}
          </h2>
          <div className="space-y-4">
            <InputNumber
              label={translate("kasirOpeningCash")}
              value={openingCash}
              onChange={setOpeningCash}
              format="currency"
              hideSpinner
            />
            <InputNumber
              label={translate("kasirClosingCash")}
              value={closingCash}
              onChange={setClosingCash}
              format="currency"
              hideSpinner
            />
            <InputNumber
              label={translate("kasirVerifiedQris")}
              value={verifiedQris}
              onChange={setVerifiedQris}
              format="currency"
              hideSpinner
            />
            <InputNumber
              label={translate("kasirCashIncome")}
              value={cashIncome}
              onChange={setCashIncome}
              format="currency"
              hideSpinner
            />
            <InputNumber
              label={translate("kasirCashExpense")}
              value={expenses}
              onChange={setExpenses}
              format="currency"
              hideSpinner
            />
            <InputNumber
              label={translate("calcRetailRevenue")}
              value={retailRevenue}
              onChange={setRetailRevenue}
              format="currency"
              hideSpinner
            />
            <InputNumber
              label={translate("calcRentalRevenue")}
              value={rentalRevenue}
              onChange={setRentalRevenue}
              format="currency"
              hideSpinner
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              {translate("calcRevenueTitle")}
            </h2>
            <div className="space-y-1 text-sm">
              <ResultRow
                label={translate("calcRetailRevenue")}
                value={formatRupiah(parseAmount(retailRevenue))}
                muted
              />
              <ResultRow
                label={translate("calcRentalRevenue")}
                value={formatRupiah(parseAmount(rentalRevenue))}
                muted
              />
              <ResultRow
                label={translate("calcTotalRevenue")}
                value={formatRupiah(result.totalSales)}
                bold
              />
              <ResultRow
                label={translate("calcEstimatedCashSales")}
                value={formatRupiah(result.estimatedCashSales)}
                muted
              />
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 text-sm sm:p-6 dark:bg-slate-800">
            <p className="font-medium text-slate-900 dark:text-white">
              {translate("kasirCashReconTitle")}
            </p>
            <div className="mt-2 space-y-1">
              <ResultRow
                label={translate("kasirOpeningCash")}
                value={formatRupiah(parseAmount(openingCash))}
              />
              <ResultRow
                label={`+ ${translate("calcTotalRevenue")}`}
                value={formatRupiah(result.totalSales)}
                muted
              />
              <ResultRow
                label={`+ ${translate("kasirCashIncome")}`}
                value={formatRupiah(parseAmount(cashIncome))}
                muted
              />
              <ResultRow
                label={`− ${translate("kasirVerifiedQris")}`}
                value={formatRupiah(parseAmount(verifiedQris))}
                muted
              />
              <ResultRow
                label={`− ${translate("kasirCashExpense")}`}
                value={formatRupiah(parseAmount(expenses))}
                muted
              />
              <ResultRow
                label={translate("kasirExpectedCashDrawer")}
                value={formatRupiah(result.expectedCashInDrawer)}
                bold
              />
              <ResultRow
                label={translate("kasirClosingCash")}
                value={formatRupiah(parseAmount(closingCash))}
              />
              <p className={varianceClass(result.cashVariance)}>
                {translate("kasirVariance")}: {formatRupiah(result.cashVariance)} (
                {varianceLabel(result.cashVariance, translate)})
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900">
            <p className="font-medium text-slate-900 dark:text-white">
              {translate("calcTotalReconTitle")}
            </p>
            <div className="mt-2 space-y-1">
              <ResultRow
                label={translate("calcTotalExpected")}
                value={formatRupiah(result.totalExpected)}
              />
              <ResultRow
                label={translate("calcTotalActual")}
                value={formatRupiah(result.totalActual)}
              />
              <p className={varianceClass(result.totalVariance)}>
                {translate("kasirVariance")}: {formatRupiah(result.totalVariance)} (
                {varianceLabel(result.totalVariance, translate)})
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {translate("calcHint")}
          </p>
        </section>
      </div>
    </PermissionGuard>
  );
}
