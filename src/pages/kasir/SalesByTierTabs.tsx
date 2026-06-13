import { useMemo, useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { useLanguage } from "../../core/context/LanguageContext";
import { formatRupiah } from "./utils";

export type PriceTierRow = {
  productId: Id<"products">;
  productName: string;
  unitPrice: number;
  qty: number;
  revenue: number;
  productType?: "RETAIL" | "RENTAL";
  rentalHoursTotal?: number;
};

type SalesTab = "retail" | "rental";

interface SalesByTierTabsProps {
  tiers: PriceTierRow[];
  variant?: "default" | "compact";
}

export function SalesByTierTabs({
  tiers,
  variant = "default",
}: SalesByTierTabsProps) {
  const { translate } = useLanguage();
  const [tab, setTab] = useState<SalesTab>("retail");

  const retailTiers = useMemo(
    () => tiers.filter((tier) => tier.productType !== "RENTAL"),
    [tiers],
  );
  const rentalTiers = useMemo(
    () => tiers.filter((tier) => tier.productType === "RENTAL"),
    [tiers],
  );

  if (tiers.length === 0) return null;

  const activeTiers = tab === "retail" ? retailTiers : rentalTiers;
  const isCompact = variant === "compact";
  const cellClass = isCompact ? "py-1 pr-2" : "px-3 py-2";
  const headClass = isCompact
    ? "py-1 pr-2 text-left text-slate-500"
    : "px-3 py-2 bg-slate-50 text-left dark:bg-slate-800";

  const tabs: { id: SalesTab; label: string; count: number }[] = [
    {
      id: "retail",
      label: translate("kasirTabRetailSales"),
      count: retailTiers.length,
    },
    {
      id: "rental",
      label: translate("kasirTabRentalSales"),
      count: rentalTiers.length,
    },
  ];

  return (
    <div className={isCompact ? "mt-4" : undefined}>
      <div className="mb-2 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1 text-xs text-slate-400">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {activeTiers.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">
          {translate("kasirNoData")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className={isCompact ? undefined : "bg-slate-50 dark:bg-slate-800"}>
              <tr>
                <th className={headClass}>Produk</th>
                <th className={headClass}>{translate("kasirPriceTier")}</th>
                <th className={headClass}>
                  {tab === "rental"
                    ? translate("kasirSoldUnitHours")
                    : translate("kasirSoldQty")}
                </th>
                <th className={isCompact ? "py-1" : "px-3 py-2"}>
                  {translate("kasirRevenue")}
                </th>
              </tr>
            </thead>
            <tbody>
              {activeTiers.map((tier) => (
                <tr
                  key={`${tier.productId}-${tier.unitPrice}`}
                  className="border-t border-slate-100 dark:border-slate-800"
                >
                  <td className={cellClass}>{tier.productName}</td>
                  <td className={cellClass}>
                    {formatRupiah(tier.unitPrice)}
                    {tab === "rental" ? translate("kasirPerHour") : ""}
                  </td>
                  <td className={cellClass}>
                    {tab === "rental"
                      ? (tier.rentalHoursTotal ?? 0)
                      : tier.qty}
                  </td>
                  <td className={isCompact ? "py-1" : "px-3 py-2"}>
                    {formatRupiah(tier.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
