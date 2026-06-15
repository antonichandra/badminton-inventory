import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { BottomSheet } from "../../../core/components/ui/BottomSheet";
import { Skeleton } from "../../../core/components/ui/Skeleton";
import { useLanguage } from "../../../core/context/LanguageContext";
import { formatDateTime } from "../../../core/utils/formatDate";
import { formatRupiah } from "../../kasir/utils";
import type { ProductRow } from "./products.config";

interface ProductPriceHistorySheetProps {
  open: boolean;
  onClose: () => void;
  sessionToken: string;
  product: ProductRow | null;
}

export function ProductPriceHistorySheet({
  open,
  onClose,
  sessionToken,
  product,
}: ProductPriceHistorySheetProps) {
  const { translate, language } = useLanguage();

  const history = useQuery(
    api.reports.getProductPriceHistory,
    open && product
      ? { sessionToken, productId: product._id }
      : "skip",
  );

  const formatShiftLabel = (
    entry: NonNullable<typeof history>[number],
  ): string => {
    if (!entry.shiftId || entry.shiftOpenedAt == null) {
      return translate("productPriceHistoryNoShift");
    }

    const openedLabel = formatDateTime(entry.shiftOpenedAt, language);

    if (
      entry.shiftStatus === "OPEN" ||
      entry.shiftStatus === "CLOSE_PENDING"
    ) {
      return `${translate("productPriceHistoryActiveShift")} · ${openedLabel}`;
    }

    if (entry.shiftClosedAt != null) {
      return `${openedLabel} – ${formatDateTime(entry.shiftClosedAt, language)}`;
    }

    return openedLabel;
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={
        product
          ? `${translate("productPriceHistory")} · ${product.name}`
          : translate("productPriceHistory")
      }
    >
      {history === undefined ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      ) : history.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          {translate("productPriceHistoryEmpty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2">
                  {translate("productPriceHistoryPrice")}
                </th>
                <th className="px-3 py-2">{translate("productColType")}</th>
                <th className="px-3 py-2">
                  {translate("productPriceHistoryEffectiveAt")}
                </th>
                <th className="px-3 py-2">
                  {translate("productPriceHistoryShift")}
                </th>
                <th className="px-3 py-2">
                  {translate("productPriceHistoryChangedBy")}
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr
                  key={entry._id}
                  className="border-t border-slate-100 dark:border-slate-800"
                >
                  <td className="px-3 py-2">
                    {formatRupiah(entry.price)}
                    {entry.priceKind === "RENTAL"
                      ? translate("kasirPerHour")
                      : ""}
                  </td>
                  <td className="px-3 py-2">
                    {entry.priceKind === "RENTAL"
                      ? translate("productTypeRental")
                      : translate("productTypeRetail")}
                  </td>
                  <td className="px-3 py-2">
                    {formatDateTime(entry.effectiveAt, language)}
                  </td>
                  <td className="px-3 py-2">{formatShiftLabel(entry)}</td>
                  <td className="px-3 py-2">{entry.changedByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </BottomSheet>
  );
}
