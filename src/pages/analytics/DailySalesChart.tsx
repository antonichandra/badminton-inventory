import { useCallback, useId, useMemo, useRef, useState } from "react";
import { cn } from "../../core/utils/cn";
import {
  formatCompactRupiah,
  getXAxisTickIndices,
} from "./chartUtils";
import type { ChartGranularity, ChartSeriesPoint } from "./rangeUtils";

export type ChartMetric = "revenue" | "profit";

interface ChartPoint extends ChartSeriesPoint {
  x: number;
  y: number;
  value: number;
}

interface DailySalesChartProps {
  series: ChartSeriesPoint[];
  metric: ChartMetric;
  granularity: ChartGranularity;
  formatValue: (amount: number) => string;
  metricLabels: {
    revenue: string;
    profit: string;
  };
}

const WIDTH = 400;
const HEIGHT = 160;
const PAD = { top: 12, right: 12, bottom: 28, left: 36 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
const Y_GRID_LINES = 4;
const TOOLTIP_WIDTH = 148;

function getMetricValue(point: ChartSeriesPoint, metric: ChartMetric): number {
  return metric === "revenue" ? point.totalRevenue : point.grossProfit;
}

function findNearestIndexByX(svgX: number, pointXs: number[]): number {
  if (pointXs.length <= 1) return 0;

  let nearest = 0;
  let minDistance = Infinity;
  for (let index = 0; index < pointXs.length; index += 1) {
    const distance = Math.abs(pointXs[index] - svgX);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = index;
    }
  }
  return nearest;
}

function clientToSvgX(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): number | null {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;

  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  return point.matrixTransform(matrix.inverse()).x;
}

function svgXToContainerPx(
  svg: SVGSVGElement,
  container: HTMLElement,
  svgX: number,
): number {
  const matrix = svg.getScreenCTM();
  if (!matrix) return 0;

  const point = svg.createSVGPoint();
  point.x = svgX;
  point.y = PAD.top;
  const screen = point.matrixTransform(matrix);
  return screen.x - container.getBoundingClientRect().left;
}

export function DailySalesChart({
  series,
  metric,
  granularity,
  formatValue,
  metricLabels,
}: DailySalesChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const xDenom = Math.max(series.length - 1, 1);

  const maxValue = Math.max(
    ...series.map((point) => getMetricValue(point, metric)),
    1,
  );

  const points: ChartPoint[] = useMemo(
    () =>
      series.map((point, index) => {
        const value = getMetricValue(point, metric);
        return {
          ...point,
          value,
          x: PAD.left + (index / xDenom) * PLOT_W,
          y: PAD.top + PLOT_H - (value / maxValue) * PLOT_H,
        };
      }),
    [series, metric, maxValue, xDenom],
  );

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const baseline = PAD.top + PLOT_H;
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`
      : "";

  const xTickIndices =
    granularity === "month"
      ? Array.from({ length: series.length }, (_, index) => index)
      : getXAxisTickIndices(series.length);

  const strokeClass =
    metric === "revenue" ? "stroke-emerald-500" : "stroke-indigo-500";
  const fillStart = metric === "revenue" ? "#10b981" : "#6366f1";
  const dotFillClass =
    metric === "revenue"
      ? "fill-emerald-500 stroke-white dark:stroke-slate-900"
      : "fill-indigo-500 stroke-white dark:stroke-slate-900";

  const horizontalGridYs = useMemo(
    () =>
      Array.from({ length: Y_GRID_LINES + 1 }, (_, index) =>
        PAD.top + (PLOT_H / Y_GRID_LINES) * index,
      ),
    [],
  );

  const yLabels = useMemo(
    () =>
      Array.from({ length: Y_GRID_LINES + 1 }, (_, index) => {
        const ratio = 1 - index / Y_GRID_LINES;
        return {
          y: PAD.top + (PLOT_H / Y_GRID_LINES) * index,
          label: formatCompactRupiah(maxValue * ratio),
        };
      }),
    [maxValue],
  );

  const updateActiveIndex = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg || points.length === 0) return;

      const svgX = clientToSvgX(svg, clientX, clientY);
      if (svgX == null) return;

      if (svgX < PAD.left || svgX > PAD.left + PLOT_W) {
        setActiveIndex(null);
        return;
      }

      setActiveIndex(findNearestIndexByX(svgX, points.map((point) => point.x)));
    },
    [points],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGRectElement>) => {
      updateActiveIndex(event.clientX, event.clientY);
    },
    [updateActiveIndex],
  );

  const handlePointerLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const activePoint = activeIndex != null ? points[activeIndex] : null;

  let tooltipStyle: React.CSSProperties | undefined;
  if (activePoint && containerRef.current && svgRef.current) {
    const pointPx = svgXToContainerPx(
      svgRef.current,
      containerRef.current,
      activePoint.x,
    );
    const containerWidth = containerRef.current.clientWidth;
    const left = Math.max(
      8,
      Math.min(containerWidth - TOOLTIP_WIDTH - 8, pointPx - TOOLTIP_WIDTH / 2),
    );
    tooltipStyle = { left, width: TOOLTIP_WIDTH };
  }

  const secondaryMetric = metric === "revenue" ? "profit" : "revenue";
  const secondaryLabel =
    secondaryMetric === "revenue" ? metricLabels.revenue : metricLabels.profit;

  return (
    <div ref={containerRef} className="relative touch-none select-none">
      {activePoint && tooltipStyle && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-2 shadow-md backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95"
          style={tooltipStyle}
          aria-live="polite"
        >
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {activePoint.tooltipLabel}
          </p>
          <p
            className={cn(
              "mt-0.5 text-sm font-semibold tabular-nums",
              metric === "revenue"
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-indigo-700 dark:text-indigo-400",
            )}
          >
            {metric === "revenue" ? metricLabels.revenue : metricLabels.profit}
            {": "}
            {formatValue(activePoint.value)}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-slate-600 dark:text-slate-400">
            {secondaryLabel}:{" "}
            {formatValue(getMetricValue(activePoint, secondaryMetric))}
          </p>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full max-h-[360px] text-emerald-500"
        role="img"
        aria-label="Sales chart"
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
            x1={PAD.left}
            y1={y}
            x2={WIDTH - PAD.right}
            y2={y}
            className="stroke-slate-200 dark:stroke-slate-700/80"
            strokeWidth="0.5"
            strokeDasharray="2 2"
          />
        ))}

        {yLabels.map((tick) => (
          <text
            key={`${tick.label}-${tick.y}`}
            x={PAD.left - 4}
            y={tick.y + 2}
            textAnchor="end"
            className="fill-slate-400 text-[7px] tabular-nums"
          >
            {tick.label}
          </text>
        ))}

        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            className={strokeClass}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {activePoint && (
          <line
            x1={activePoint.x}
            y1={PAD.top}
            x2={activePoint.x}
            y2={baseline}
            className="stroke-slate-400 dark:stroke-slate-500"
            strokeWidth="1"
            strokeDasharray="3 3"
            pointerEvents="none"
          />
        )}

        {points.map((point, index) => {
          const isActive = activeIndex === index;
          const showDot = isActive || point.value > 0;

          if (!showDot) return null;

          return (
            <circle
              key={point.key}
              cx={point.x}
              cy={point.y}
              r={isActive ? 5 : 3}
              className={dotFillClass}
              strokeWidth={isActive ? 2 : 1}
              pointerEvents="none"
            />
          );
        })}

        {xTickIndices.map((index) => (
          <text
            key={series[index]?.key ?? index}
            x={points[index]?.x ?? PAD.left}
            y={HEIGHT - 8}
            textAnchor="middle"
            className="fill-slate-400 text-[7px]"
          >
            {series[index]?.axisLabel ?? ""}
          </text>
        ))}

        <rect
          x={PAD.left}
          y={PAD.top}
          width={PLOT_W}
          height={PLOT_H}
          fill="transparent"
          className="cursor-crosshair"
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerLeave}
        />
      </svg>
    </div>
  );
}
