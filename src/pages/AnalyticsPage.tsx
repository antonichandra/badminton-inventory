import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "../core/components/PageHeader";
import { PermissionGuard } from "../core/components/PermissionGuard";
import { MetricCard } from "../core/components/ui/MetricCard";
import { useAuth } from "../core/context/AuthContext";
import { useBusiness } from "../core/context/BusinessContext";
import { useLanguage } from "../core/context/LanguageContext";
import { formatDateOnly } from "../core/utils/formatDate";
import { formatRupiah } from "./kasir/utils";
import {
  buildDailyChartSeries,
  CHART_PERIOD_OPTIONS,
  formatGrowthPercent,
  type ChartPeriod,
} from "./analytics/chartUtils";
import { DailySalesChart, type ChartMetric } from "./analytics/DailySalesChart";

export function AnalyticsPage() {
  const { translate, language } = useLanguage();
  const { sessionToken } = useAuth();
  const { activeBusinessId } = useBusiness();
  const [period, setPeriod] = useState<ChartPeriod>(30);
  const [metric, setMetric] = useState<ChartMetric>("revenue");

  const rollups = useQuery(
    api.reports.getDailyRollups,
    sessionToken
      ? {
          sessionToken,
          businessId: activeBusinessId ?? undefined,
          days: period,
        }
      : "skip",
  );
  const monthly = useQuery(
    api.reports.getMonthlyComparison,
    sessionToken
      ? { sessionToken, businessId: activeBusinessId ?? undefined }
      : "skip",
  );
  const expiring = useQuery(
    api.reports.getExpiringBatches,
    sessionToken
      ? {
          sessionToken,
          businessId: activeBusinessId ?? undefined,
          withinDays: 30,
        }
      : "skip",
  );
  const lowStock = useQuery(
    api.reports.getLowStockProducts,
    sessionToken
      ? { sessionToken, businessId: activeBusinessId ?? undefined, maxQty: 5 }
      : "skip",
  );
  const liveStats = useQuery(
    api.shifts.getShiftLiveStats,
    sessionToken ? { sessionToken } : "skip",
  );

  const chartSeries = useMemo(
    () => buildDailyChartSeries(rollups ?? [], period),
    [rollups, period],
  );

  const periodStats = useMemo(() => {
    const totalRevenue = chartSeries.reduce((sum, d) => sum + d.totalRevenue, 0);
    const totalProfit = chartSeries.reduce((sum, d) => sum + d.grossProfit, 0);
    const activeDays = chartSeries.filter((d) => d.totalRevenue > 0).length;
    const margin =
      totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
    const avgPerDay =
      activeDays > 0 ? Math.round(totalRevenue / activeDays) : 0;

    return { totalRevenue, totalProfit, activeDays, margin, avgPerDay };
  }, [chartSeries]);

  const monthGrowth =
    monthly != null
      ? formatGrowthPercent(monthly.thisMonth, monthly.lastMonth)
      : null;

  const hasSales = chartSeries.some((day) => day.totalRevenue > 0);
  const loading = rollups === undefined || monthly === undefined;

  const periodLabel = (days: ChartPeriod) => {
    if (days === 7) return translate("analyticsPeriod7");
    if (days === 90) return translate("analyticsPeriod90");
    return translate("analyticsPeriod30");
  };

  return (
    <PermissionGuard permission="analytics">
      <PageHeader
        title={translate("analyticsTitle")}
        subtitle={translate("analyticsSubtitle")}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label={translate("kasirThisMonth")}
          value={formatRupiah(monthly?.thisMonth ?? 0)}
          loading={loading}
          delta={
            monthGrowth
              ? {
                  text: `${monthGrowth.text} ${translate("dashboardVsLastMonth")}`,
                  tone: monthGrowth.tone,
                }
              : undefined
          }
        />
        <MetricCard
          label={translate("analyticsPeriodTotal")}
          value={formatRupiah(periodStats.totalRevenue)}
          loading={loading}
        />
        <MetricCard
          label={translate("analyticsMargin")}
          value={`${periodStats.margin}%`}
          loading={loading}
          delta={{
            text: formatRupiah(periodStats.totalProfit),
            tone: "neutral",
          }}
        />
        <MetricCard
          label={translate("analyticsAvgPerDay")}
          value={formatRupiah(periodStats.avgPerDay)}
          loading={loading}
          delta={{
            text: `${periodStats.activeDays} ${translate("analyticsActiveDays")}`,
            tone: "neutral",
          }}
        />
      </div>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {translate("analyticsDailyChart")}
          </h3>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
              {CHART_PERIOD_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setPeriod(days)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    period === days
                      ? "bg-emerald-600 text-white"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {periodLabel(days)}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
              {(
                [
                  ["revenue", "analyticsMetricRevenue"],
                  ["profit", "analyticsMetricProfit"],
                ] as const
              ).map(([key, labelKey]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMetric(key)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    metric === key
                      ? key === "revenue"
                        ? "bg-emerald-600 text-white"
                        : "bg-indigo-600 text-white"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {translate(labelKey)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!hasSales && rollups !== undefined ? (
          <p className="text-sm text-slate-500">{translate("analyticsNoSales")}</p>
        ) : rollups === undefined ? (
          <div className="h-40 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        ) : (
          <DailySalesChart
            series={chartSeries}
            metric={metric}
            formatValue={formatRupiah}
          />
        )}
      </section>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {liveStats && liveStats.topProducts.length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {translate("kasirTopProducts")}
            </h3>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {liveStats.topProducts.slice(0, 5).map((product) => (
                <li
                  key={product.productId}
                  className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0"
                >
                  <span className="font-medium text-slate-900 dark:text-white">
                    {product.productName}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-400">
                    {product.qty} · {formatRupiah(product.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {translate("analyticsLowStock")}
          </h3>
          {(lowStock ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              {translate("analyticsLowStockEmpty")}
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              {lowStock!.map((item) => (
                <li
                  key={item.productId}
                  className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0"
                >
                  <span className="font-medium text-slate-900 dark:text-white">
                    {item.productName}
                  </span>
                  <span
                    className={
                      item.qtyOnHand === 0
                        ? "rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-400"
                        : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-400"
                    }
                  >
                    {item.qtyOnHand} {item.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {(expiring ?? []).length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-900/20">
          <h3 className="font-semibold text-amber-800 dark:text-amber-300">
            {translate("analyticsExpiring")}
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {expiring!.map((batch, index) => (
              <li
                key={index}
                className="flex justify-between gap-3 border-b border-amber-200/60 py-2 last:border-0 dark:border-amber-800/40"
              >
                <span className="font-medium text-amber-950 dark:text-amber-100">
                  {batch.productName}
                </span>
                <span className="shrink-0 text-amber-900 dark:text-amber-200">
                  {batch.qtyRemaining} pcs ·{" "}
                  {formatDateOnly(batch.expiresAt!, language)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PermissionGuard>
  );
}
