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

export interface CloseStockPreviewRow {
  productId: Id<"products">;
  productName: string;
  categoryId?: Id<"productCategories">;
  categoryName?: string;
  openingQty: number;
  receivedQty: number;
  writeOffQty: number;
  closingQty: number;
  soldFromStock: number;
  soldFromLines: number;
  overInputQty: number;
  missInputQty: number;
  unitPrice: number;
  revenue: number;
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
      row.receivedQty > 0 ||
      row.openingQty > 0 ||
      row.closingQty > 0 ||
      row.writeOffQty > 0,
  );

  if (visibleRows.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-500">
        {translate("kasirNoData")}
      </p>
    );
  }

  const groups = groupByCategory(visibleRows);
  const grandOmset = visibleRows.reduce((sum, row) => sum + row.revenue, 0);

  return (
    <CategoryGroupsContainer>
      {groups.map((group) => {
        const totalSold = group.items.reduce(
          (sum, row) => sum + row.soldFromStock,
          0,
        );
        const totalOmset = group.items.reduce(
          (sum, row) => sum + row.revenue,
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
        const metaParts = [
          `${totalSold} fisik`,
          formatRupiah(totalOmset),
        ];
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
                  <KasirTh compact>{translate("kasirOpeningStock")}</KasirTh>
                  <KasirTh compact>{translate("kasirReceived")}</KasirTh>
                  <KasirTh compact>{translate("kasirWriteOff")}</KasirTh>
                  <KasirTh compact>{translate("kasirClosingStock")}</KasirTh>
                  <KasirTh compact>{translate("kasirSoldPhysical")}</KasirTh>
                  <KasirTh compact>{translate("kasirItemPrice")}</KasirTh>
                  <KasirTh compact>{translate("kasirItemOmset")}</KasirTh>
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
                    <KasirTd compact className="tabular-nums">
                      {row.openingQty}
                    </KasirTd>
                    <KasirTd compact className="tabular-nums">
                      {row.receivedQty || "—"}
                    </KasirTd>
                    <KasirTd compact className="tabular-nums">
                      {row.writeOffQty || "—"}
                    </KasirTd>
                    <KasirTd compact className="tabular-nums">
                      {row.closingQty}
                    </KasirTd>
                    <KasirTd compact className="font-medium tabular-nums">
                      {row.soldFromStock}
                    </KasirTd>
                    <KasirTd compact className="tabular-nums">
                      {row.unitPrice > 0 ? formatRupiah(row.unitPrice) : "—"}
                    </KasirTd>
                    <KasirTd compact className="font-medium tabular-nums">
                      {row.revenue > 0 ? formatRupiah(row.revenue) : "—"}
                    </KasirTd>
                    <KasirTd compact className="tabular-nums">
                      {row.soldFromLines}
                    </KasirTd>
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
      <p className="px-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        {translate("kasirItemOmset")}: {formatRupiah(grandOmset)}
      </p>
    </CategoryGroupsContainer>
  );
}
