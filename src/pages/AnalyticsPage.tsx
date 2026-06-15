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
import { ChartRangeControls } from "./analytics/ChartRangeControls";
import { formatGrowthPercent } from "./analytics/chartUtils";
import { DailySalesChart, type ChartMetric } from "./analytics/DailySalesChart";
import { PeriodInsights } from "./analytics/PeriodInsights";
import {
  formatAnalyticsRangeLabel,
  getDefaultAnalyticsRange,
  resolveAnalyticsRange,
  resolveChartGranularity,
  resolveChartSeries,
  type AnalyticsRangeState,
  type ChartPeriod,
} from "./analytics/rangeUtils";

export function AnalyticsPage() {
  const { translate, language } = useLanguage();
  const { sessionToken } = useAuth();
  const { activeBusinessId } = useBusiness();
  const [range, setRange] = useState<AnalyticsRangeState>(getDefaultAnalyticsRange);
  const [metric, setMetric] = useState<ChartMetric>("revenue");

  const dateRange = useMemo(() => resolveAnalyticsRange(range), [range]);
  const rangeQueryArgs = useMemo(
    () => ({
      startDate: dateRange.startDateKey,
      endDate: dateRange.endDateKey,
    }),
    [dateRange],
  );

  const rollups = useQuery(
    api.reports.getDailyRollups,
    sessionToken
      ? {
          sessionToken,
          businessId: activeBusinessId ?? undefined,
          ...rangeQueryArgs,
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
  const topSellingProducts = useQuery(
    api.reports.getTopSellingProducts,
    sessionToken
      ? {
          sessionToken,
          businessId: activeBusinessId ?? undefined,
          ...rangeQueryArgs,
        }
      : "skip",
  );
  const topSpendingGroups = useQuery(
    api.reports.getTopSpendingGroups,
    sessionToken
      ? {
          sessionToken,
          businessId: activeBusinessId ?? undefined,
          ...rangeQueryArgs,
        }
      : "skip",
  );

  const chartSeries = useMemo(
    () => resolveChartSeries(rollups ?? [], range, language),
    [rollups, range, language],
  );

  const periodStats = useMemo(() => {
    const rows = rollups ?? [];
    const totalRevenue = rows.reduce((sum, d) => sum + d.totalRevenue, 0);
    const totalProfit = rows.reduce(
      (sum, d) =>
        sum + (d.grossProfit ?? d.totalRevenue - (d.totalCogs ?? 0)),
      0,
    );
    const activeDays = rows.filter((d) => d.totalRevenue > 0).length;
    const margin =
      totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
    const avgPerDay =
      activeDays > 0 ? Math.round(totalRevenue / activeDays) : 0;

    return { totalRevenue, totalProfit, activeDays, margin, avgPerDay };
  }, [rollups]);

  const monthGrowth =
    monthly != null
      ? formatGrowthPercent(monthly.thisMonth, monthly.lastMonth)
      : null;

  const hasSales = periodStats.totalRevenue > 0;
  const loading = rollups === undefined || monthly === undefined;
  const rangeLabel = formatAnalyticsRangeLabel(range, language, translate);

  const handleRollingChange = (period: ChartPeriod) => {
    setRange((prev) => ({ ...prev, mode: "rolling", period }));
  };

  const handleModeChange = (mode: AnalyticsRangeState["mode"]) => {
    setRange((prev) => ({ ...prev, mode }));
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ChartRangeControls
              range={range}
              onRollingChange={handleRollingChange}
              onMonthChange={(monthValue) =>
                setRange((prev) => ({ ...prev, mode: "month", monthValue }))
              }
              onYearChange={(yearValue) =>
                setRange((prev) => ({ ...prev, mode: "year", yearValue }))
              }
              onModeChange={handleModeChange}
              labels={{
                period7: translate("analyticsPeriod7"),
                period30: translate("analyticsPeriod30"),
                period90: translate("analyticsPeriod90"),
                month: translate("analyticsRangeMonth"),
                year: translate("analyticsRangeYear"),
                pickMonth: translate("analyticsPickMonth"),
                pickYear: translate("analyticsPickYear"),
              }}
            />
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
            granularity={resolveChartGranularity(range)}
            formatValue={formatRupiah}
            metricLabels={{
              revenue: translate("analyticsMetricRevenue"),
              profit: translate("analyticsMetricProfit"),
            }}
          />
        )}
      </section>

      <PeriodInsights
        periodLabel={rangeLabel}
        topProducts={topSellingProducts}
        topGroups={topSpendingGroups}
        labels={{
          topProductsTitle: translate("analyticsTopProducts"),
          topGroupsTitle: translate("analyticsTopGroups"),
          productName: translate("productColName"),
          price: translate("productColPrice"),
          profit: translate("analyticsMetricProfit"),
          qty: translate("kasirSoldQty"),
          spend: translate("analyticsGroupSpend"),
          groupProducts: translate("analyticsGroupProducts"),
          emptyProducts: translate("analyticsTopProductsEmpty"),
          emptyGroups: translate("analyticsTopGroupsEmpty"),
        }}
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-1">
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
