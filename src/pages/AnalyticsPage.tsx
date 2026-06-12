import { useId, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "../core/components/PageHeader";
import { PermissionGuard } from "../core/components/PermissionGuard";
import { useAuth } from "../core/context/AuthContext";
import { useBusiness } from "../core/context/BusinessContext";
import { useLanguage } from "../core/context/LanguageContext";
import { formatRupiah } from "./kasir/utils";

const CHART_DAYS = 30;
const CHART_HEIGHT_PX = 180;
const X_AXIS_TICKS = 5;

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildDailyChartSeries(
  rollups: { date: string; totalRevenue: number }[],
  days: number,
) {
  const byDate = new Map(rollups.map((row) => [row.date, row.totalRevenue]));
  const series = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = toDateKey(date);
    series.push({
      date: key,
      totalRevenue: byDate.get(key) ?? 0,
    });
  }

  return series;
}

function getXAxisTickIndices(count: number, maxTicks: number): number[] {
  if (count <= 1) return [0];
  if (count <= maxTicks) {
    return Array.from({ length: count }, (_, index) => index);
  }

  const step = Math.ceil((count - 1) / (maxTicks - 1));
  const ticks: number[] = [];
  for (let index = 0; index < count; index += step) {
    ticks.push(index);
  }
  if (ticks[ticks.length - 1] !== count - 1) {
    ticks.push(count - 1);
  }
  return ticks;
}

function formatAxisLabel(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${Number(day)}/${Number(month)}`;
}

interface DailySalesLineChartProps {
  series: { date: string; totalRevenue: number }[];
  maxRevenue: number;
  formatValue: (amount: number) => string;
}

function DailySalesLineChart({
  series,
  maxRevenue,
  formatValue,
}: DailySalesLineChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const width = 100;
  const height = 100;
  const pad = { top: 8, right: 4, bottom: 18, left: 4 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const xDenom = Math.max(series.length - 1, 1);
  const yGridLines = 4;

  const points = series.map((day, index) => ({
    ...day,
    x: pad.left + (index / xDenom) * plotW,
    y: pad.top + plotH - (day.totalRevenue / maxRevenue) * plotH,
  }));

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const baseline = pad.top + plotH;
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;

  const xTicks = getXAxisTickIndices(series.length, X_AXIS_TICKS);

  const horizontalGridYs = useMemo(
    () =>
      Array.from({ length: yGridLines + 1 }, (_, index) =>
        pad.top + (plotH / yGridLines) * index,
      ),
    [plotH, yGridLines],
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full text-emerald-500"
      style={{ height: CHART_HEIGHT_PX }}
      role="img"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
          <stop offset="85%" stopColor="#10b981" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>

      {horizontalGridYs.map((y) => (
        <line
          key={`h-${y}`}
          x1={pad.left}
          y1={y}
          x2={width - pad.right}
          y2={y}
          className="stroke-slate-200 dark:stroke-slate-700/80"
          strokeWidth="0.35"
          strokeDasharray="1.2 1.4"
        />
      ))}
      {xTicks.map((index) => (
        <line
          key={`v-${series[index].date}`}
          x1={points[index].x}
          y1={pad.top}
          x2={points[index].x}
          y2={baseline}
          className="stroke-slate-200 dark:stroke-slate-700/80"
          strokeWidth="0.35"
          strokeDasharray="1.2 1.4"
        />
      ))}

      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        className="stroke-emerald-500"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points
        .filter((point) => point.totalRevenue > 0)
        .map((point) => (
          <circle
            key={point.date}
            cx={point.x}
            cy={point.y}
            r="1.4"
            className="fill-emerald-500 stroke-white dark:stroke-slate-900"
            strokeWidth="0.5"
          >
            <title>{`${formatAxisLabel(point.date)}: ${formatValue(point.totalRevenue)}`}</title>
          </circle>
        ))}
      {xTicks.map((index) => (
        <text
          key={series[index].date}
          x={points[index].x}
          y={height - 4}
          textAnchor="middle"
          className="fill-slate-400 text-[3.5px]"
        >
          {formatAxisLabel(series[index].date)}
        </text>
      ))}
    </svg>
  );
}

export function AnalyticsPage() {
  const { translate } = useLanguage();
  const { sessionToken } = useAuth();
  const { activeBusinessId } = useBusiness();

  const rollups = useQuery(
    api.reports.getDailyRollups,
    sessionToken
      ? {
          sessionToken,
          businessId: activeBusinessId ?? undefined,
          days: CHART_DAYS,
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
      ? { sessionToken, businessId: activeBusinessId ?? undefined, withinDays: 30 }
      : "skip",
  );
  const lowStock = useQuery(
    api.reports.getLowStockProducts,
    sessionToken
      ? { sessionToken, businessId: activeBusinessId ?? undefined, maxQty: 5 }
      : "skip",
  );

  const chartSeries = useMemo(
    () => buildDailyChartSeries(rollups ?? [], CHART_DAYS),
    [rollups],
  );

  const maxRevenue = Math.max(
    ...chartSeries.map((day) => day.totalRevenue),
    1,
  );

  const hasSales = chartSeries.some((day) => day.totalRevenue > 0);

  return (
    <PermissionGuard permission="kasir">
      <PageHeader
        title={translate("analyticsTitle")}
        subtitle={translate("analyticsSubtitle")}
      />

      {monthly && (
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm text-slate-500">{translate("kasirThisMonth")}</p>
            <p className="mt-1 text-2xl font-bold">
              {formatRupiah(monthly.thisMonth)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm text-slate-500">{translate("kasirLastMonth")}</p>
            <p className="mt-1 text-2xl font-bold">
              {formatRupiah(monthly.lastMonth)}
            </p>
          </div>
        </div>
      )}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-4 font-semibold">{translate("analyticsDailyChart")}</h3>
        {!hasSales && rollups !== undefined ? (
          <p className="text-sm text-slate-500">{translate("analyticsNoSales")}</p>
        ) : (
          <DailySalesLineChart
            series={chartSeries}
            maxRevenue={maxRevenue}
            formatValue={formatRupiah}
          />
        )}
      </section>

      <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
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
                        ? "font-semibold text-red-600 dark:text-red-400"
                        : "text-amber-700 dark:text-amber-400"
                    }
                  >
                    {item.qtyOnHand} {item.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {(expiring ?? []).length > 0 && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <h3 className="font-semibold text-amber-800 dark:text-amber-300">
              {translate("analyticsExpiring")}
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {expiring!.map((batch, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{batch.productName}</span>
                  <span className="shrink-0 text-amber-900 dark:text-amber-200">
                    {batch.qtyRemaining} pcs ·{" "}
                    {new Date(batch.expiresAt!).toLocaleDateString("id-ID")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PermissionGuard>
  );
}
