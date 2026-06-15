import { cn } from "../../core/utils/cn";
import {
  CHART_PERIOD_OPTIONS,
  type AnalyticsRangeState,
  type ChartPeriod,
} from "./rangeUtils";

interface ChartRangeControlsProps {
  range: AnalyticsRangeState;
  onRollingChange: (period: ChartPeriod) => void;
  onMonthChange: (monthValue: string) => void;
  onYearChange: (year: number) => void;
  onModeChange: (mode: AnalyticsRangeState["mode"]) => void;
  labels: {
    period7: string;
    period30: string;
    period90: string;
    month: string;
    year: string;
    pickMonth: string;
    pickYear: string;
  };
}

function periodLabel(
  days: ChartPeriod,
  labels: ChartRangeControlsProps["labels"],
): string {
  if (days === 7) return labels.period7;
  if (days === 90) return labels.period90;
  return labels.period30;
}

const inputClass =
  "rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-emerald-500";

export function ChartRangeControls({
  range,
  onRollingChange,
  onMonthChange,
  onYearChange,
  onModeChange,
  labels,
}: ChartRangeControlsProps) {
  const modeButtonClass = (active: boolean) =>
    cn(
      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
      active
        ? "bg-emerald-600 text-white"
        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
        {CHART_PERIOD_OPTIONS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => onRollingChange(days)}
            className={modeButtonClass(
              range.mode === "rolling" && range.period === days,
            )}
          >
            {periodLabel(days, labels)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onModeChange("month")}
          className={modeButtonClass(range.mode === "month")}
        >
          {labels.month}
        </button>
        <button
          type="button"
          onClick={() => onModeChange("year")}
          className={modeButtonClass(range.mode === "year")}
        >
          {labels.year}
        </button>
      </div>

      {range.mode === "month" && (
        <input
          type="month"
          aria-label={labels.pickMonth}
          value={range.monthValue}
          onChange={(event) => onMonthChange(event.target.value)}
          className={inputClass}
        />
      )}

      {range.mode === "year" && (
        <select
          aria-label={labels.pickYear}
          value={range.yearValue}
          onChange={(event) => onYearChange(Number(event.target.value))}
          className={inputClass}
        >
          {Array.from({ length: 6 }, (_, index) => {
            const year = new Date().getFullYear() - index;
            return (
              <option key={year} value={year}>
                {year}
              </option>
            );
          })}
        </select>
      )}
    </div>
  );
}
