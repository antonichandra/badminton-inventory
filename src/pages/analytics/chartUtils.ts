export const CHART_PERIOD_OPTIONS = [7, 30, 90] as const;
export type ChartPeriod = (typeof CHART_PERIOD_OPTIONS)[number];

const X_AXIS_TICKS = 6;

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function buildDailyChartSeries(
  rollups: {
    date: string;
    totalRevenue: number;
    totalCogs?: number;
    grossProfit?: number;
  }[],
  days: number,
) {
  const byDate = new Map(
    rollups.map((row) => [
      row.date,
      {
        totalRevenue: row.totalRevenue,
        totalCogs: row.totalCogs ?? 0,
        grossProfit:
          row.grossProfit ?? row.totalRevenue - (row.totalCogs ?? 0),
      },
    ]),
  );
  const series = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = toDateKey(date);
    const entry = byDate.get(key);
    series.push({
      date: key,
      totalRevenue: entry?.totalRevenue ?? 0,
      grossProfit: entry?.grossProfit ?? 0,
    });
  }

  return series;
}

export function getXAxisTickIndices(count: number, maxTicks = X_AXIS_TICKS): number[] {
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

export function formatAxisLabel(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${Number(day)}/${Number(month)}`;
}

export function formatCompactRupiah(amount: number): string {
  if (amount >= 1_000_000) {
    const jt = amount / 1_000_000;
    return jt >= 10 ? `${Math.round(jt)}jt` : `${jt.toFixed(1)}jt`;
  }
  if (amount >= 1_000) {
    return `${Math.round(amount / 1_000)}rb`;
  }
  return String(amount);
}

export function formatGrowthPercent(thisMonth: number, lastMonth: number): {
  text: string;
  tone: "positive" | "negative" | "neutral";
} {
  if (lastMonth <= 0) {
    if (thisMonth > 0) {
      return { text: "↑ baru", tone: "positive" };
    }
    return { text: "—", tone: "neutral" };
  }
  const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
  if (pct > 0) return { text: `↑ ${pct}%`, tone: "positive" };
  if (pct < 0) return { text: `↓ ${Math.abs(pct)}%`, tone: "negative" };
  return { text: "0%", tone: "neutral" };
}
