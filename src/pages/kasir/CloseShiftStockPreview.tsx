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

export interface CloseStockPreviewRow {
  productId: Id<"products">;
  productName: string;
  categoryId?: Id<"productCategories">;
  categoryName?: string;
  receivedQty: number;
  soldFromStock: number;
  soldFromLines: number;
  overInputQty: number;
  missInputQty: number;
}

interface CloseShiftStockPreviewProps {
  rows: CloseStockPreviewRow[];
}

export function CloseShiftStockPreview({ rows }: CloseShiftStockPreviewProps) {
  const { translate } = useLanguage();

  const visibleRows = rows.filter(
    (row) =>
      row.soldFromStock > 0 ||
      row.soldFromLines > 0 ||
      row.receivedQty > 0,
  );

  if (visibleRows.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-500">
        {translate("kasirNoData")}
      </p>
    );
  }

  const groups = groupByCategory(visibleRows);

  return (
    <CategoryGroupsContainer>
      {groups.map((group) => {
        const totalSold = group.items.reduce(
          (sum, row) => sum + row.soldFromStock,
          0,
        );
        const totalMiss = group.items.reduce(
          (sum, row) => sum + row.missInputQty,
          0,
        );
        const totalOver = group.items.reduce(
          (sum, row) => sum + row.overInputQty,
          0,
        );
        const metaParts = [`${totalSold} fisik`];
        if (totalMiss > 0) metaParts.push(`${totalMiss} miss`);
        if (totalOver > 0) metaParts.push(`${totalOver} over`);

        return (
          <CategoryGroupSection
            key={group.categoryId ?? group.categoryName}
            categoryName={group.categoryName}
            itemCountLabel={translate("categoryItemCount").replace(
              "{count}",
              String(group.items.length),
            )}
            meta={metaParts.join(" · ")}
          >
            <table className={kasirCompactTableClass}>
              <thead className={kasirCompactTheadClass}>
                <tr>
                  <KasirTh compact>Produk</KasirTh>
                  <KasirTh compact>{translate("kasirSoldPhysical")}</KasirTh>
                  <KasirTh compact>{translate("kasirSoldRecorded")}</KasirTh>
                  <KasirTh compact>{translate("kasirMissInput")}</KasirTh>
                  <KasirTh compact>{translate("kasirOverInput")}</KasirTh>
                </tr>
              </thead>
              <tbody className={kasirCompactTbodyClass}>
                {group.items.map((row) => (
                  <tr key={row.productId} className={kasirCompactTrClass}>
                    <KasirTd
                      compact
                      className="font-medium text-slate-900 dark:text-white"
                    >
                      {row.productName}
                    </KasirTd>
                    <KasirTd compact className="font-medium">
                      {row.soldFromStock}
                    </KasirTd>
                    <KasirTd compact>{row.soldFromLines}</KasirTd>
                    <KasirTd compact className="text-blue-600 dark:text-blue-400">
                      {row.missInputQty || "—"}
                    </KasirTd>
                    <KasirTd compact className="text-amber-600 dark:text-amber-400">
                      {row.overInputQty || "—"}
                    </KasirTd>
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
