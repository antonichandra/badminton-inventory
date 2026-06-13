import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../../core/components/ui/Button";
import { useLanguage } from "../../core/context/LanguageContext";
import { formatDateTime } from "../../core/utils/formatDate";
import { SalesByTierTabs } from "./SalesByTierTabs";
import { formatRupiah } from "./utils";

interface ShiftReportPanelProps {
  sessionToken: string;
  businessId: Id<"businesses">;
  onBack: () => void;
  onViewShift?: (shiftId: Id<"shifts">) => void;
}

export function ShiftReportPanel({
  sessionToken,
  businessId,
  onBack,
  onViewShift,
}: ShiftReportPanelProps) {
  const { translate, language } = useLanguage();

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
      <Button variant="ghost" size="sm" onClick={onBack}>
        {translate("cancel")}
      </Button>

      {liveStats && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {translate("kasirLiveReport")}
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-500">{translate("kasirRevenue")}</p>
              <p className="font-semibold">
                {formatRupiah(liveStats.paidRevenue)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">{translate("kasirGrossProfit")}</p>
              <p className="font-semibold">
                {formatRupiah(liveStats.grossProfit)}
              </p>
            </div>
          </div>

          {liveStats.topProducts.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase text-slate-500">
                {translate("kasirTopProducts")}
              </p>
              {liveStats.topProducts.slice(0, 5).map((p) => (
                <div
                  key={p.productId}
                  className="flex justify-between text-sm py-1"
                >
                  <span>{p.productName}</span>
                  <span>
                    {p.qty} · {formatRupiah(p.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <SalesByTierTabs
            tiers={liveStats.salesByPriceTier}
            variant="compact"
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
                  {formatRupiah(summary.totalRevenue)} ·{" "}
                  {translate("kasirGrossProfit")}{" "}
                  {formatRupiah(summary.grossProfit)}
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
