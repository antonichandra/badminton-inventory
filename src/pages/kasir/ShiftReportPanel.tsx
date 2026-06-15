import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../../core/components/ui/Button";
import { useAuth } from "../../core/context/AuthContext";
import { useLanguage } from "../../core/context/LanguageContext";
import { formatDateTime } from "../../core/utils/formatDate";
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

type TopProductRow = {
  productId: Id<"products">;
  productName: string;
  qty: number;
  revenue: number;
  cogs?: number;
  grossProfit?: number;
};

export function ShiftReportPanel({
  sessionToken,
  businessId,
  onViewShift,
}: ShiftReportPanelProps) {
  const { translate, language } = useLanguage();
  const { role } = useAuth();
  const showGrossProfit = role?.name === "ADMIN";

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
                {formatRupiah(liveStats.paidRevenue)}
              </p>
            </div>
            {showGrossProfit && liveStats.grossProfit !== undefined && (
              <div>
                <p className="text-slate-500">{translate("kasirGrossProfit")}</p>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatRupiah(liveStats.grossProfit)}
                </p>
              </div>
            )}
          </div>

          {liveStats.topProducts.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                {translate("kasirTopProducts")}
              </p>
              <KasirTableShell>
                <table className={kasirTableClass}>
                  <thead className={kasirTheadClass}>
                    <tr>
                      <KasirTh>Produk</KasirTh>
                      <KasirTh>{translate("kasirSoldQty")}</KasirTh>
                      <KasirTh>{translate("kasirRevenue")}</KasirTh>
                      {showGrossProfit && (
                        <KasirTh>{translate("kasirGrossProfit")}</KasirTh>
                      )}
                    </tr>
                  </thead>
                  <tbody className={kasirTbodyClass}>
                    {liveStats.topProducts.slice(0, 5).map((p: TopProductRow) => (
                      <tr key={p.productId} className={kasirTrClass}>
                        <KasirTd className="font-medium text-slate-900 dark:text-white">
                          {p.productName}
                        </KasirTd>
                        <KasirTd>{p.qty}</KasirTd>
                        <KasirTd className="font-medium">
                          {formatRupiah(p.revenue)}
                        </KasirTd>
                        {showGrossProfit && (
                          <KasirTd className="font-medium text-emerald-700 dark:text-emerald-400">
                            {formatRupiah(
                              p.grossProfit ?? p.revenue - (p.cogs ?? 0),
                            )}
                          </KasirTd>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </KasirTableShell>
            </div>
          )}

          <SalesByTierTabs
            tiers={liveStats.salesByPriceTier}
            showGrossProfit={showGrossProfit}
          />
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
                  {showGrossProfit && (
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
