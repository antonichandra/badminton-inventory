import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../../core/components/ui/Button";
import { useAuth } from "../../core/context/AuthContext";
import { useLanguage } from "../../core/context/LanguageContext";
import { formatDateTime } from "../../core/utils/formatDate";
import { showProfitDetail } from "../../core/utils/showProfitDetail";
import { SalesByTierTabs } from "./SalesByTierTabs";
import {
  KasirTableShell,
  KasirTd,
  KasirTh,
  kasirTableClass,
  kasirTbodyClass,
  kasirTheadClass,
  kasirTrClass,
} from "./KasirTable";
import { formatRupiah } from "./utils";

interface ShiftReportPanelProps {
  sessionToken: string;
  businessId: Id<"businesses">;
  onViewShift?: (shiftId: Id<"shifts">) => void;
}

export function ShiftReportPanel({
  sessionToken,
  businessId,
  onViewShift,
}: ShiftReportPanelProps) {
  const { translate, language } = useLanguage();
  const { role } = useAuth();
  const showGrossProfit = showProfitDetail(role);

  const liveStats = useQuery(api.shifts.getShiftLiveStats, { sessionToken });
  const summaries = useQuery(api.shifts.listShiftSummaries, {
    sessionToken,
    businessId,
    limit: 20,
  });
  const monthly = useQuery(api.reports.getMonthlyComparison, {
    sessionToken,
    businessId,
  });

  return (
    <div className="space-y-6">
      {liveStats && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {translate("kasirLiveReport")}
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-slate-500">{translate("kasirRevenue")}</p>
              <p className="font-semibold">
                {formatRupiah(liveStats.totalRevenue ?? liveStats.paidRevenue)}
              </p>
            </div>
            {showGrossProfit && liveStats.impliedRevenue > 0 && (
              <div>
                <p className="text-slate-500">{translate("kasirImpliedRevenue")}</p>
                <p className="font-semibold text-blue-700 dark:text-blue-400">
                  {formatRupiah(liveStats.impliedRevenue)}
                </p>
              </div>
            )}
            {showGrossProfit && liveStats.grossProfit !== undefined && (
              <div>
                <p className="text-slate-500">{translate("kasirGrossProfit")}</p>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatRupiah(liveStats.grossProfit)}
                </p>
              </div>
            )}
          </div>

          <SalesByTierTabs
            tiers={liveStats.salesByPriceTier}
            showGrossProfit={showGrossProfit}
          />

          {(liveStats.cashEntries.length > 0 || liveStats.writeOffs.length > 0) && (
            <div className="mt-6 space-y-4">
              {liveStats.cashEntries.filter((e) => e.type === "EXPENSE").length >
                0 && (
                <LiveCashTable
                  title={translate("kasirTabExpenses")}
                  rows={liveStats.cashEntries.filter((e) => e.type === "EXPENSE")}
                />
              )}
              {liveStats.cashEntries.filter((e) => e.type === "DEPOSIT").length >
                0 && (
                <LiveCashTable
                  title={translate("kasirTabDeposits")}
                  rows={liveStats.cashEntries.filter((e) => e.type === "DEPOSIT")}
                />
              )}
              {liveStats.cashEntries.filter((e) => e.type === "INCOME").length >
                0 && (
                <LiveCashTable
                  title={translate("kasirTabIncome")}
                  rows={liveStats.cashEntries.filter((e) => e.type === "INCOME")}
                />
              )}
              {liveStats.writeOffs.length > 0 && (
                <LiveWriteOffTable
                  title={translate("kasirTabWriteOffs")}
                  rows={liveStats.writeOffs}
                />
              )}
            </div>
          )}
        </section>
      )}

      {monthly && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {translate("kasirMonthlyCompare")}
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-500">{translate("kasirThisMonth")}</p>
              <p className="font-semibold">
                {formatRupiah(monthly.thisMonth)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">{translate("kasirLastMonth")}</p>
              <p className="font-semibold">
                {formatRupiah(monthly.lastMonth)}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="font-semibold text-slate-900 dark:text-white">
          {translate("kasirShiftHistory")}
        </h3>
        <div className="mt-3 space-y-2">
          {(summaries ?? []).map((summary) => (
            <div
              key={summary._id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left hover:opacity-80"
                onClick={() => onViewShift?.(summary.shiftId)}
              >
                <p className="text-sm font-medium">
                  {formatDateTime(summary.closedAt, language)}
                </p>
                <p className="text-xs text-slate-500">
                  {formatRupiah(summary.totalRevenue)}
                  {showGrossProfit && "grossProfit" in summary && (
                    <>
                      {" "}
                      · {translate("kasirGrossProfit")}{" "}
                      {formatRupiah(summary.grossProfit)}
                    </>
                  )}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                {onViewShift && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewShift(summary.shiftId)}
                  >
                    {translate("kasirViewDetail")}
                  </Button>
                )}
              </div>
            </div>
          ))}
          {(summaries ?? []).length === 0 && (
            <p className="text-sm text-slate-500">
              {translate("kasirNoShiftHistory")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function LiveCashTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    _id: Id<"cashEntries">;
    amount: number;
    note: string;
    createdAt: number;
    recordedByName: string;
  }>;
}) {
  const { translate, language } = useLanguage();

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
        {title}
      </p>
      <KasirTableShell>
        <table className={kasirTableClass}>
          <thead className={kasirTheadClass}>
            <tr>
              <KasirTh>{translate("kasirDate")}</KasirTh>
              <KasirTh>{translate("kasirPayTotal")}</KasirTh>
              <KasirTh>{translate("kasirNote")}</KasirTh>
            </tr>
          </thead>
          <tbody className={kasirTbodyClass}>
            {rows.map((row) => (
              <tr key={row._id} className={kasirTrClass}>
                <KasirTd className="whitespace-nowrap">
                  {formatDateTime(row.createdAt, language)}
                </KasirTd>
                <KasirTd className="font-medium">
                  {formatRupiah(row.amount)}
                </KasirTd>
                <KasirTd>{row.note}</KasirTd>
              </tr>
            ))}
          </tbody>
        </table>
      </KasirTableShell>
    </div>
  );
}

function LiveWriteOffTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    _id: Id<"stockMovements">;
    productName: string;
    productUnit: string;
    qty: number;
    note: string;
    createdAt: number;
  }>;
}) {
  const { translate, language } = useLanguage();

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
        {title}
      </p>
      <KasirTableShell>
        <table className={kasirTableClass}>
          <thead className={kasirTheadClass}>
            <tr>
              <KasirTh>{translate("kasirDate")}</KasirTh>
              <KasirTh>Produk</KasirTh>
              <KasirTh>{translate("kasirQty")}</KasirTh>
              <KasirTh>{translate("kasirNote")}</KasirTh>
            </tr>
          </thead>
          <tbody className={kasirTbodyClass}>
            {rows.map((row) => (
              <tr key={row._id} className={kasirTrClass}>
                <KasirTd className="whitespace-nowrap">
                  {formatDateTime(row.createdAt, language)}
                </KasirTd>
                <KasirTd>
                  {row.productName}
                  {row.productUnit ? ` (${row.productUnit})` : ""}
                </KasirTd>
                <KasirTd>{row.qty}</KasirTd>
                <KasirTd>{row.note}</KasirTd>
              </tr>
            ))}
          </tbody>
        </table>
      </KasirTableShell>
    </div>
  );
}
