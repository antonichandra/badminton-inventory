interface QuotaHeaderProps {
  showQuota: boolean;
  businessCount: number;
  maxBusiness: number;
  staffCount: number;
  maxStaff: number;
  labels: {
    business: string;
    staff: string;
  };
}

export function QuotaHeader({
  showQuota,
  businessCount,
  maxBusiness,
  staffCount,
  maxStaff,
  labels,
}: QuotaHeaderProps) {
  if (!showQuota) {
    return null;
  }

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {labels.business
            .replace("{current}", String(businessCount))
            .replace("{max}", String(maxBusiness))}
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {labels.staff
            .replace("{current}", String(staffCount))
            .replace("{max}", String(maxStaff))}
        </p>
      </div>
    </div>
  );
}
