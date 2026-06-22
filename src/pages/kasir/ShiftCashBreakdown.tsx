import { useLanguage } from "../../core/context/LanguageContext";
import { ShiftQrisBreakdown } from "./ShiftQrisBreakdown";
import { formatRupiah } from "./utils";

export interface ShiftCashBreakdownProps {
  openingCash: number;
  totalSales: number;
  cashIncome?: number;
  verifiedQris: number;
  recordedQrisSales?: number;
  expenses: number;
  deposits: number;
  expectedCashInDrawer: number;
  reportedCash: number;
  cashVariance: number;
  totalRevenue?: number;
  recordedRevenue?: number;
  impliedRevenue?: number;
  totalCogs?: number;
  grossProfit?: number;
  overInputQtyTotal?: number;
  missInputQtyTotal?: number;
  showRevenueBreakdown?: boolean;
  compact?: boolean;
}

export function ShiftCashBreakdown({
  openingCash,
  totalSales,
  cashIncome = 0,
  verifiedQris,
  recordedQrisSales,
  expenses,
  deposits,
  expectedCashInDrawer,
  reportedCash,
  cashVariance,
  totalRevenue,
  recordedRevenue,
  impliedRevenue,
  totalCogs,
  grossProfit,
  overInputQtyTotal,
  missInputQtyTotal,
  showRevenueBreakdown = false,
  compact = false,
}: ShiftCashBreakdownProps) {
  const { translate } = useLanguage();

  const varianceClass =
    cashVariance < 0
      ? "font-semibold text-red-600"
      : cashVariance > 0
        ? "font-semibold text-emerald-600"
        : "font-semibold text-slate-700 dark:text-slate-200";

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-700"
          : "rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800"
      }
    >
      {!compact && (totalRevenue !== undefined || grossProfit !== undefined) && (
        <div className="mb-4 grid grid-cols-2 gap-3 border-b border-slate-200 pb-4 dark:border-slate-700 sm:grid-cols-3">
          {showRevenueBreakdown &&
            recordedRevenue !== undefined &&
            (impliedRevenue ?? 0) > 0 && (
              <>
                <div>
                  <p className="text-xs text-slate-500">
                    {translate("kasirRecordedRevenue")}
                  </p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {formatRupiah(recordedRevenue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">
                    {translate("kasirImpliedRevenue")}
                  </p>
                  <p className="font-semibold text-blue-700 dark:text-blue-400">
                    {formatRupiah(impliedRevenue ?? 0)}
                  </p>
                </div>
              </>
            )}
          {totalRevenue !== undefined && (
            <div>
              <p className="text-xs text-slate-500">{translate("kasirNetRevenue")}</p>
              <p className="font-semibold text-slate-900 dark:text-white">
                {formatRupiah(totalRevenue)}
              </p>
            </div>
          )}
          {totalCogs !== undefined && (
            <div>
              <p className="text-xs text-slate-500">{translate("kasirTotalCogs")}</p>
              <p className="font-semibold">{formatRupiah(totalCogs)}</p>
            </div>
          )}
          {grossProfit !== undefined && (
            <div>
              <p className="text-xs text-slate-500">{translate("kasirGrossProfit")}</p>
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                {formatRupiah(grossProfit)}
              </p>
            </div>
          )}
        </div>
      )}

      {(overInputQtyTotal ?? 0) > 0 || (missInputQtyTotal ?? 0) > 0 ? (
        <p className="mb-3 text-slate-600 dark:text-slate-300">
          {translate("kasirSalesGapTitle")}: {translate("kasirOverInput")}{" "}
          {overInputQtyTotal ?? 0} · {translate("kasirMissInput")}{" "}
          {missInputQtyTotal ?? 0}
        </p>
      ) : null}

      {!compact && recordedQrisSales !== undefined && (
        <ShiftQrisBreakdown
          recordedQrisSales={recordedQrisSales}
          verifiedQris={verifiedQris}
        />
      )}

      <p className="font-medium text-slate-900 dark:text-white">
        {translate("kasirCashReconTitle")}
      </p>
      <div className="mt-2 space-y-1">
        <Row label={translate("kasirOpeningCash")} value={formatRupiah(openingCash)} />
        <Row
          label={`+ ${translate("kasirTotalSales")}`}
          value={formatRupiah(totalSales)}
          muted
        />
        <Row
          label={`+ ${translate("kasirCashIncome")}`}
          value={formatRupiah(cashIncome)}
          muted
        />
        <Row
          label={`− ${translate("kasirVerifiedQris")}`}
          value={formatRupiah(verifiedQris)}
          muted
        />
        <Row
          label={`− ${translate("kasirCashExpense")}`}
          value={formatRupiah(expenses)}
          muted
        />
        <Row
          label={`− ${translate("kasirCashDeposit")}`}
          value={formatRupiah(deposits)}
          muted
        />
        <Row
          label={translate("kasirExpectedCashDrawer")}
          value={formatRupiah(expectedCashInDrawer)}
          bold
        />
        <Row label={translate("kasirClosingCash")} value={formatRupiah(reportedCash)} />
        <p className={varianceClass}>
          {translate("kasirVariance")}: {formatRupiah(cashVariance)}
          {cashVariance < 0 && ` (${translate("kasirStaffMinus")})`}
          {cashVariance > 0 && ` (${translate("kasirStaffPlus")})`}
          {cashVariance === 0 && ` (${translate("kasirStaffExact")})`}
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 ${muted ? "text-slate-500" : ""} ${bold ? "border-t border-slate-200 pt-1 font-medium text-slate-900 dark:border-slate-700 dark:text-white" : ""}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
