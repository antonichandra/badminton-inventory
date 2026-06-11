interface StatItem {
  label: string;
  value: number;
}

interface StatSection {
  title: string;
  items: StatItem[];
  total?: StatItem;
}

interface AdminListStatsProps {
  sections: StatSection[];
  isLoading?: boolean;
  loadingLabel: string;
}

function StatBadge({
  label,
  value,
  emphasis = false,
}: StatItem & { emphasis?: boolean }) {
  return (
    <div
      className={
        emphasis
          ? "inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 dark:border-emerald-900/50 dark:bg-emerald-950/30"
          : "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800/50"
      }
    >
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span
        className={
          emphasis
            ? "text-sm font-semibold text-emerald-700 dark:text-emerald-300"
            : "text-sm font-semibold text-slate-800 dark:text-slate-100"
        }
      >
        {value}
      </span>
    </div>
  );
}

export function AdminListStats({
  sections,
  isLoading = false,
  loadingLabel,
}: AdminListStatsProps) {
  if (isLoading) {
    return (
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-500">{loadingLabel}</p>
      </div>
    );
  }

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {section.title}
          </p>
          <div className="flex flex-wrap gap-2">
            {section.items.map((item) => (
              <StatBadge key={item.label} label={item.label} value={item.value} />
            ))}
            {section.total && (
              <StatBadge
                label={section.total.label}
                value={section.total.value}
                emphasis
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
