import { useLanguage } from "../../core/context/LanguageContext";
import { formatRupiah } from "./utils";

export interface ShiftQrisBreakdownProps {
  recordedQrisSales: number;
  verifiedQris: number;
}

export function ShiftQrisBreakdown({
  recordedQrisSales,
  verifiedQris,
}: ShiftQrisBreakdownProps) {
  const { translate } = useLanguage();
  const qrisVariance = verifiedQris - recordedQrisSales;

  const varianceClass =
    qrisVariance < 0
      ? "font-semibold text-red-600"
      : qrisVariance > 0
        ? "font-semibold text-emerald-600"
        : "font-semibold text-slate-700 dark:text-slate-200";

  return (
    <div className="mb-4 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800">
      <p className="font-medium text-slate-900 dark:text-white">
        {translate("kasirQrisReconTitle")}
      </p>
      <div className="mt-2 space-y-1">
        <Row
          label={translate("kasirRecordedQris")}
          value={formatRupiah(recordedQrisSales)}
        />
        <Row
          label={translate("kasirVerifiedQris")}
          value={formatRupiah(verifiedQris)}
        />
        <p className={varianceClass}>
          {translate("kasirQrisVariance")}: {formatRupiah(qrisVariance)}
          {qrisVariance < 0 && ` (${translate("kasirQrisBankShort")})`}
          {qrisVariance > 0 && ` (${translate("kasirQrisBankOver")})`}
          {qrisVariance === 0 && ` (${translate("kasirStaffExact")})`}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
