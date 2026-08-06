import { useMemo, useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { useLanguage } from "../../core/context/LanguageContext";
import { groupByCategory } from "../../core/utils/groupByCategory";
import {
  CategoryGroupSection,
  CategoryGroupsContainer,
} from "../../core/components/categoryGroup";
import {
  KasirTd,
  KasirTh,
  kasirCompactTableClass,
  kasirCompactTheadClass,
  kasirCompactTbodyClass,
  kasirCompactTrClass,
} from "./KasirTable";
import { formatRupiah } from "./utils";

export type PriceTierRow = {
  productId: Id<"products">;
  productName: string;
  categoryId?: Id<"productCategories">;
  categoryName?: string;
  unitPrice: number;
  qty: number;
  revenue: number;
  cogs?: number;
  unitCost?: number;
  grossProfit?: number;
  productType?: "RETAIL" | "RENTAL";
  rentalHoursTotal?: number;
  receivedQty?: number;
  writeOffQty?: number;
};

type SalesTab = "retail" | "rental";

interface SalesByTierTabsProps {
  tiers: PriceTierRow[];
  showGrossProfit?: boolean;
}

function formatHours(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(/\.0$/, "");
}

function rentalHoursPerUnit(tier: PriceTierRow): number {
  if (tier.qty <= 0) return 0;
  return (tier.rentalHoursTotal ?? 0) / tier.qty;
}

function TierTable({
  tiers,
  tab,
  showGrossProfit,
}: {
  tiers: PriceTierRow[];
  tab: SalesTab;
  showGrossProfit: boolean;
}) {
  const { translate } = useLanguage();
  const groups = useMemo(() => groupByCategory(tiers), [tiers]);

  if (tiers.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-500">
        {translate("kasirNoData")}
      </p>
    );
  }

  return (
    <CategoryGroupsContainer>
      {groups.map((group) => {
        const totalRevenue = group.items.reduce((sum, tier) => sum + tier.revenue, 0);
        const totalUnits = group.items.reduce((sum, tier) => sum + tier.qty, 0);
        const totalHours = group.items.reduce(
          (sum, tier) => sum + (tier.rentalHoursTotal ?? 0),
          0,
        );
        const meta =
          tab === "rental"
            ? `${totalUnits} ${translate("kasirUnits")} · ${formatHours(totalHours)} ${translate("kasirHours").toLowerCase()} · ${formatRupiah(totalRevenue)}`
            : `${totalUnits} · ${formatRupiah(totalRevenue)}`;

        return (
          <CategoryGroupSection
            key={group.categoryId ?? group.categoryName}
            categoryName={group.categoryName}
            itemCountLabel={translate("categoryItemCount").replace(
              "{count}",
              String(group.items.length),
            )}
            meta={meta}
          >
            <table className={kasirCompactTableClass}>
              <thead className={kasirCompactTheadClass}>
                <tr>
                  <KasirTh compact>Produk</KasirTh>
                  <KasirTh compact>{translate("kasirPriceTier")}</KasirTh>
                  {showGrossProfit && tab === "retail" && (
                    <KasirTh compact>{translate("kasirBuyPrice")}</KasirTh>
                  )}
                  {tab === "rental" ? (
                    <>
                      <KasirTh compact>{translate("kasirUnit")}</KasirTh>
                      <KasirTh compact>{translate("kasirHours")}</KasirTh>
                    </>
                  ) : (
                    <>
                      <KasirTh compact>{translate("kasirSoldQty")}</KasirTh>
                      <KasirTh compact>{translate("kasirReceived")}</KasirTh>
                      <KasirTh compact>{translate("kasirWriteOff")}</KasirTh>
                    </>
                  )}
                  <KasirTh compact>{translate("kasirRevenue")}</KasirTh>
                  {showGrossProfit && (
                    <KasirTh compact>{translate("kasirGrossProfit")}</KasirTh>
                  )}
                </tr>
              </thead>
              <tbody className={kasirCompactTbodyClass}>
                {group.items.map((tier) => (
                  <tr
                    key={`${tier.productId}-${tier.unitPrice}`}
                    className={kasirCompactTrClass}
                  >
                    <KasirTd
                      compact
                      className="font-medium text-slate-900 dark:text-white"
                    >
                      {tier.productName}
                    </KasirTd>
                    <KasirTd compact>
                      {formatRupiah(tier.unitPrice)}
                      {tab === "rental" ? translate("kasirPerHour") : ""}
                    </KasirTd>
                    {showGrossProfit && tab === "retail" && (
                      <KasirTd compact>
                        {tier.unitCost != null && tier.unitCost > 0
                          ? formatRupiah(tier.unitCost)
                          : "—"}
                      </KasirTd>
                    )}
                    {tab === "rental" ? (
                      <>
                        <KasirTd compact>{tier.qty}</KasirTd>
                        <KasirTd compact>
                          {formatHours(rentalHoursPerUnit(tier))}
                        </KasirTd>
                      </>
                    ) : (
                      <>
                        <KasirTd compact>{tier.qty}</KasirTd>
                        <KasirTd compact>{tier.receivedQty ?? 0}</KasirTd>
                        <KasirTd compact>{tier.writeOffQty ?? 0}</KasirTd>
                      </>
                    )}
                    <KasirTd compact className="font-medium">
                      {formatRupiah(tier.revenue)}
                    </KasirTd>
                    {showGrossProfit && (
                      <KasirTd
                        compact
                        className="font-medium text-emerald-700 dark:text-emerald-400"
                      >
                        {formatRupiah(
                          tier.grossProfit ?? tier.revenue - (tier.cogs ?? 0),
                        )}
                      </KasirTd>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </CategoryGroupSection>
        );
      })}
    </CategoryGroupsContainer>
  );
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
            className={`rounded-t-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? "border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1 text-[10px] text-slate-400">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      <TierTable
        tiers={activeTiers}
        tab={tab}
        showGrossProfit={showGrossProfit}
      />
    </div>
  );
}

/** Attach shift stock in/out qty onto sales tier rows (by product). */
export function withStockMovementQty<
  T extends { productId: Id<"products"> },
>(
  tiers: T[],
  stockRows: Array<{
    productId: Id<"products">;
    receivedQty: number;
    writeOffQty: number;
  }>,
): Array<T & { receivedQty: number; writeOffQty: number }> {
  const byProduct = new Map(
    stockRows.map((row) => [
      row.productId,
      { receivedQty: row.receivedQty, writeOffQty: row.writeOffQty },
    ]),
  );

  return tiers.map((tier) => {
    const stock = byProduct.get(tier.productId);
    return {
      ...tier,
      receivedQty: stock?.receivedQty ?? 0,
      writeOffQty: stock?.writeOffQty ?? 0,
    };
  });
}
