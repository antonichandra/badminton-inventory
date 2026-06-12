import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../../core/components/ui/Button";
import { useLanguage } from "../../core/context/LanguageContext";
import { useToast } from "../../core/context/ToastContext";
import { ExportShiftButton } from "./ExportShiftButton";
import { formatRupiah } from "./utils";

interface ShiftSummaryViewProps {
  sessionToken: string;
  shiftId: Id<"shifts">;
  onOpenNewShift: () => void;
}

export function ShiftSummaryView({
  sessionToken,
  shiftId,
  onOpenNewShift,
}: ShiftSummaryViewProps) {
  const { translate } = useLanguage();
  const { showToast } = useToast();
  const archiveShift = useMutation(api.shifts.archiveShift);

  const data = useQuery(api.shifts.getShiftSummary, {
    sessionToken,
    shiftId,
  });

  const handleArchive = async () => {
    try {
      await archiveShift({ sessionToken, shiftId });
      showToast({
        type: "success",
        message: translate("kasirArchiveSuccess"),
      });
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: translate("unexpectedError") });
    }
  };

  if (!data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <p className="text-slate-500">{translate("loading")}</p>
      </div>
    );
  }

  const priceTiers =
    data.summary?.salesByPriceTier ?? data.salesByPriceTier ?? [];
  const stockRows = data.summary
    ? data.summary.topProducts.map((p) => ({
        productId: p.productId,
        productName: p.productName,
        soldQty: p.qty,
        revenue: p.revenue,
      }))
    : (data.stockSummary ?? []).map((row) => ({
        productId: row.productId,
        productName: row.productName,
        soldQty: row.soldQty,
        revenue: row.revenue,
      }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {translate("kasirSummary")}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {translate("kasirRevenue")}: {formatRupiah(data.totalRevenue)}
        </p>
        {data.summary && (
          <p className="text-sm text-slate-500">
            {translate("kasirGrossProfit")}:{" "}
            {formatRupiah(data.summary.grossProfit)}
          </p>
        )}

        {priceTiers.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2">Produk</th>
                  <th className="px-3 py-2">{translate("kasirPriceTier")}</th>
                  <th className="px-3 py-2">{translate("kasirSoldQty")}</th>
                  <th className="px-3 py-2">{translate("kasirRevenue")}</th>
                </tr>
              </thead>
              <tbody>
                {priceTiers.map((tier) => (
                  <tr
                    key={`${tier.productId}-${tier.unitPrice}`}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="px-3 py-2">{tier.productName}</td>
                    <td className="px-3 py-2">
                      {formatRupiah(tier.unitPrice)}
                    </td>
                    <td className="px-3 py-2">{tier.qty}</td>
                    <td className="px-3 py-2">{formatRupiah(tier.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {stockRows.length > 0 && priceTiers.length === 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2">Produk</th>
                  <th className="px-3 py-2">{translate("kasirSoldQty")}</th>
                  <th className="px-3 py-2">{translate("kasirRevenue")}</th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map((row) => (
                  <tr
                    key={row.productId}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="px-3 py-2">{row.productName}</td>
                    <td className="px-3 py-2">{row.soldQty}</td>
                    <td className="px-3 py-2">{formatRupiah(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800">
          <p>
            {translate("kasirExpected")}:{" "}
            {formatRupiah(data.cashSummary.expectedTotal)}
          </p>
          <p>
            {translate("kasirActual")}:{" "}
            {formatRupiah(data.cashSummary.actualTotal)}
          </p>
          <p
            className={
              data.cashSummary.variance < 0
                ? "font-semibold text-red-600"
                : "font-semibold text-emerald-600"
            }
          >
            {translate("kasirVariance")}:{" "}
            {formatRupiah(data.cashSummary.variance)}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <ExportShiftButton sessionToken={sessionToken} shiftId={shiftId} />
          <Button variant="outline" size="sm" onClick={handleArchive}>
            {translate("kasirArchiveShift")}
          </Button>
        </div>
      </div>

      <Button className="w-full" onClick={onOpenNewShift}>
        {translate("kasirOpenShift")}
      </Button>
    </div>
  );
}
