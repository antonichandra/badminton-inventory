import type { AppLanguage } from "../../core/utils/formatDate";
import {
  CHART_PERIOD_OPTIONS,
  formatAxisLabel,
  formatDayTooltipLabel,
  formatMonthAxisLabel,
  formatMonthTooltipLabel,
  toDateKey,
  type ChartPeriod,
} from "./chartUtils";

export type { ChartPeriod };

export type ChartGranularity = "day" | "month";

export interface ChartSeriesPoint {
  key: string;
  totalRevenue: number;
  grossProfit: number;
  axisLabel: string;
  tooltipLabel: string;
}

type RollupRow = {
  date: string;
  totalRevenue: number;
  totalCogs?: number;
  grossProfit?: number;
};

export type AnalyticsRangeMode = "rolling" | "month" | "year";

export interface SaleDateRange {
  startDateKey: string;
  endDateKey: string;
}

export interface AnalyticsRangeState {
  mode: AnalyticsRangeMode;
  period: ChartPeriod;
  monthValue: string;
  yearValue: number;
}

export function getDefaultMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getDefaultAnalyticsRange(): AnalyticsRangeState {
  return {
    mode: "rolling",
    period: 30,
    monthValue: getDefaultMonthValue(),
    yearValue: new Date().getFullYear(),
  };
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function rollingSaleDateRange(days: number): SaleDateRange {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return {
    startDateKey: toDateKey(start),
    endDateKey: toDateKey(end),
  };
}

export function monthSaleDateRange(monthValue: string): SaleDateRange {
  const [year, month] = monthValue.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return {
    startDateKey: toDateKey(start),
    endDateKey: toDateKey(end),
  };
}

export function yearSaleDateRange(year: number): SaleDateRange {
  return {
    startDateKey: `${year}-01-01`,
    endDateKey: `${year}-12-31`,
  };
}

export function resolveAnalyticsRange(state: AnalyticsRangeState): SaleDateRange {
  if (state.mode === "month") {
    return monthSaleDateRange(state.monthValue);
  }
  if (state.mode === "year") {
    return yearSaleDateRange(state.yearValue);
  }
  return rollingSaleDateRange(state.period);
}

function rollupValue(row: RollupRow | undefined) {
  if (!row) return { totalRevenue: 0, grossProfit: 0 };
  return {
    totalRevenue: row.totalRevenue,
    grossProfit: row.grossProfit ?? row.totalRevenue - (row.totalCogs ?? 0),
  };
}

export function buildDailyChartSeriesForRange(
  rollups: RollupRow[],
  range: SaleDateRange,
  language: AppLanguage,
): ChartSeriesPoint[] {
  const byDate = new Map(rollups.map((row) => [row.date, row]));

  const series: ChartSeriesPoint[] = [];
  const cursor = parseDateKey(range.startDateKey);
  const end = parseDateKey(range.endDateKey);

  while (cursor <= end) {
    const key = toDateKey(cursor);
    const values = rollupValue(byDate.get(key));
    series.push({
      key,
      ...values,
      axisLabel: formatAxisLabel(key),
      tooltipLabel: formatDayTooltipLabel(key, language),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return series;
}

export function buildMonthlyChartSeriesForYear(
  rollups: RollupRow[],
  year: number,
  language: AppLanguage,
): ChartSeriesPoint[] {
  const byMonth = new Map<string, { totalRevenue: number; grossProfit: number }>();

  for (const row of rollups) {
    if (!row.date.startsWith(`${year}-`)) continue;
    const monthKey = row.date.slice(0, 7);
    const values = rollupValue(row);
    const entry = byMonth.get(monthKey) ?? { totalRevenue: 0, grossProfit: 0 };
    entry.totalRevenue += values.totalRevenue;
    entry.grossProfit += values.grossProfit;
    byMonth.set(monthKey, entry);
  }

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const values = byMonth.get(monthKey) ?? { totalRevenue: 0, grossProfit: 0 };
    return {
      key: monthKey,
      totalRevenue: values.totalRevenue,
      grossProfit: values.grossProfit,
      axisLabel: formatMonthAxisLabel(month, language),
      tooltipLabel: formatMonthTooltipLabel(year, month, language),
    };
  });
}

export function resolveChartGranularity(
  state: AnalyticsRangeState,
): ChartGranularity {
  return state.mode === "year" ? "month" : "day";
}

export function resolveChartSeries(
  rollups: RollupRow[],
  state: AnalyticsRangeState,
  language: AppLanguage,
): ChartSeriesPoint[] {
  if (state.mode === "year") {
    return buildMonthlyChartSeriesForYear(rollups, state.yearValue, language);
  }
  return buildDailyChartSeriesForRange(
    rollups,
    resolveAnalyticsRange(state),
    language,
  );
}

export function formatAnalyticsRangeLabel(
  state: AnalyticsRangeState,
  language: AppLanguage,
  translate: (key: "analyticsPeriod7" | "analyticsPeriod30" | "analyticsPeriod90") => string,
): string {
  if (state.mode === "rolling") {
    if (state.period === 7) return translate("analyticsPeriod7");
    if (state.period === 90) return translate("analyticsPeriod90");
    return translate("analyticsPeriod30");
  }

  const locale = language === "ID" ? "id-ID" : "en-US";

  if (state.mode === "month") {
    const [year, month] = state.monthValue.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(date);
  }

  return String(state.yearValue);
}

export function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let year = currentYear; year >= currentYear - 5; year -= 1) {
    years.push(year);
  }
  return years;
}

export { CHART_PERIOD_OPTIONS };
