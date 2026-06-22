import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "../../core/context/AuthContext";
import { useLanguage } from "../../core/context/LanguageContext";
import { showProfitDetail } from "../../core/utils/showProfitDetail";
import { formatRupiah } from "./utils";

interface ShiftLiveStatsProps {
  sessionToken: string;
}

export function ShiftLiveStats({ sessionToken }: ShiftLiveStatsProps) {
  const { translate } = useLanguage();
  const { role } = useAuth();
  const showGrossProfit = showProfitDetail(role);
  const stats = useQuery(api.shifts.getShiftLiveStats, { sessionToken });

  if (!stats) return null;

  return (
    <div
      className={`grid grid-cols-2 gap-2 ${showGrossProfit && stats.grossProfit !== undefined ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}
    >
      <StatCard
        label={translate("kasirRevenue")}
        value={formatRupiah(stats.paidRevenue)}
      />
      <StatCard
        label={translate("kasirUnpaid")}
        value={formatRupiah(stats.unpaidRevenue)}
      />
      {showGrossProfit && stats.grossProfit !== undefined && (
        <StatCard
          label={translate("kasirGrossProfit")}
          value={formatRupiah(stats.grossProfit)}
        />
      )}
      <StatCard
        label={translate("kasirTopProduct")}
        value={stats.topProducts[0]?.productName ?? "—"}
        small
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-0.5 font-semibold text-slate-900 dark:text-white ${small ? "truncate text-sm" : "text-base"}`}
      >
        {value}
      </p>
    </div>
  );
}
