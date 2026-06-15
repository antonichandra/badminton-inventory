import { useId, useMemo } from "react";
import {
  formatAxisLabel,
  formatCompactRupiah,
  getXAxisTickIndices,
} from "./chartUtils";

export type ChartMetric = "revenue" | "profit";

interface ChartPoint {
  date: string;
  totalRevenue: number;
  grossProfit: number;
  x: number;
  y: number;
  value: number;
}

interface DailySalesChartProps {
  series: { date: string; totalRevenue: number; grossProfit: number }[];
  metric: ChartMetric;
  formatValue: (amount: number) => string;
}

export function DailySalesChart({
  series,
  metric,
  formatValue,
}: DailySalesChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const width = 400;
  const height = 160;
  const pad = { top: 12, right: 12, bottom: 28, left: 36 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const xDenom = Math.max(series.length - 1, 1);
  const yGridLines = 4;

  const maxValue = Math.max(
    ...series.map((day) =>
      metric === "revenue" ? day.totalRevenue : day.grossProfit,
    ),
    1,
  );

  const points: ChartPoint[] = series.map((day, index) => {
    const value = metric === "revenue" ? day.totalRevenue : day.grossProfit;
    return {
      ...day,
      value,
      x: pad.left + (index / xDenom) * plotW,
      y: pad.top + plotH - (value / maxValue) * plotH,
    };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const baseline = pad.top + plotH;
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
  const xTicks = getXAxisTickIndices(series.length);
  const strokeClass =
    metric === "revenue" ? "stroke-emerald-500" : "stroke-indigo-500";
  const fillStart =
    metric === "revenue" ? "#10b981" : "#6366f1";

  const horizontalGridYs = useMemo(
    () =>
      Array.from({ length: yGridLines + 1 }, (_, index) =>
        pad.top + (plotH / yGridLines) * index,
      ),
    [plotH, yGridLines],
  );

  const yLabels = useMemo(
    () =>
      Array.from({ length: yGridLines + 1 }, (_, index) => {
        const ratio = 1 - index / yGridLines;
        return {
          y: pad.top + (plotH / yGridLines) * index,
          label: formatCompactRupiah(maxValue * ratio),
        };
      }),
    [maxValue, plotH, yGridLines],
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full max-h-[360px] text-emerald-500"
      role="img"
      aria-label="Daily sales chart"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillStart} stopOpacity="0.35" />
          <stop offset="85%" stopColor={fillStart} stopOpacity="0.08" />
          <stop offset="100%" stopColor={fillStart} stopOpacity="0" />
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
          strokeWidth="0.5"
          strokeDasharray="2 2"
        />
      ))}

      {yLabels.map((tick) => (
        <text
          key={tick.label}
          x={pad.left - 4}
          y={tick.y + 2}
          textAnchor="end"
          className="fill-slate-400 text-[7px] tabular-nums"
        >
          {tick.label}
        </text>
      ))}

      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        className={strokeClass}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points
        .filter((point) => point.value > 0)
        .map((point) => (
          <circle
            key={point.date}
            cx={point.x}
            cy={point.y}
            r="3"
            className={
              metric === "revenue"
                ? "fill-emerald-500 stroke-white dark:stroke-slate-900"
                : "fill-indigo-500 stroke-white dark:stroke-slate-900"
            }
            strokeWidth="1"
          >
            <title>{`${formatAxisLabel(point.date)}: ${formatValue(point.value)}`}</title>
          </circle>
        ))}
      {xTicks.map((index) => (
        <text
          key={series[index].date}
          x={points[index].x}
          y={height - 8}
          textAnchor="middle"
          className="fill-slate-400 text-[7px]"
        >
          {formatAxisLabel(series[index].date)}
        </text>
      ))}
    </svg>
  );
}
