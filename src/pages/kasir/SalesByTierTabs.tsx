import { useMemo, useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { useLanguage } from "../../core/context/LanguageContext";
import {
  KasirTableShell,
  KasirTd,
  KasirTh,
  kasirTableClass,
  kasirTbodyClass,
  kasirTheadClass,
  kasirTrClass,
} from "./KasirTable";
import { formatRupiah } from "./utils";

export type PriceTierRow = {
  productId: Id<"products">;
  productName: string;
  unitPrice: number;
  qty: number;
  revenue: number;
  cogs?: number;
  unitCost?: number;
  grossProfit?: number;
  productType?: "RETAIL" | "RENTAL";
  rentalHoursTotal?: number;
};

type SalesTab = "retail" | "rental";

interface SalesByTierTabsProps {
  tiers: PriceTierRow[];
  showGrossProfit?: boolean;
}

export function SalesByTierTabs({
  tiers,
  showGrossProfit = false,
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
    <div>
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
        <KasirTableShell>
          <table className={kasirTableClass}>
            <thead className={kasirTheadClass}>
              <tr>
                <KasirTh>Produk</KasirTh>
                <KasirTh>{translate("kasirPriceTier")}</KasirTh>
                {showGrossProfit && tab === "retail" && (
                  <KasirTh>{translate("kasirBuyPrice")}</KasirTh>
                )}
                <KasirTh>
                  {tab === "rental"
                    ? translate("kasirSoldUnitHours")
                    : translate("kasirSoldQty")}
                </KasirTh>
                <KasirTh>{translate("kasirRevenue")}</KasirTh>
                {showGrossProfit && (
                  <KasirTh>{translate("kasirGrossProfit")}</KasirTh>
                )}
              </tr>
            </thead>
            <tbody className={kasirTbodyClass}>
              {activeTiers.map((tier) => (
                <tr
                  key={`${tier.productId}-${tier.unitPrice}`}
                  className={kasirTrClass}
                >
                  <KasirTd className="font-medium text-slate-900 dark:text-white">
                    {tier.productName}
                  </KasirTd>
                  <KasirTd>
                    {formatRupiah(tier.unitPrice)}
                    {tab === "rental" ? translate("kasirPerHour") : ""}
                  </KasirTd>
                  {showGrossProfit && tab === "retail" && (
                    <KasirTd>
                      {tier.unitCost != null && tier.unitCost > 0
                        ? formatRupiah(tier.unitCost)
                        : "—"}
                    </KasirTd>
                  )}
                  <KasirTd>
                    {tab === "rental"
                      ? (tier.rentalHoursTotal ?? 0)
                      : tier.qty}
                  </KasirTd>
                  <KasirTd className="font-medium">
                    {formatRupiah(tier.revenue)}
                  </KasirTd>
                  {showGrossProfit && (
                    <KasirTd className="font-medium text-emerald-700 dark:text-emerald-400">
                      {formatRupiah(
                        tier.grossProfit ?? tier.revenue - (tier.cogs ?? 0),
                      )}
                    </KasirTd>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </KasirTableShell>
      )}
    </div>
  );
}
