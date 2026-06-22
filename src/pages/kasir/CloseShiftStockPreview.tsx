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

export interface CloseStockPreviewRow {
  productId: Id<"products">;
  productName: string;
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

  return (
    <KasirTableShell>
      <table className={kasirTableClass}>
        <thead className={kasirTheadClass}>
          <tr>
            <KasirTh>Produk</KasirTh>
            <KasirTh>{translate("kasirSoldPhysical")}</KasirTh>
            <KasirTh>{translate("kasirSoldRecorded")}</KasirTh>
            <KasirTh>{translate("kasirMissInput")}</KasirTh>
            <KasirTh>{translate("kasirOverInput")}</KasirTh>
          </tr>
        </thead>
        <tbody className={kasirTbodyClass}>
          {visibleRows.map((row) => (
            <tr key={row.productId} className={kasirTrClass}>
              <KasirTd className="font-medium text-slate-900 dark:text-white">
                {row.productName}
              </KasirTd>
              <KasirTd className="font-medium">{row.soldFromStock}</KasirTd>
              <KasirTd>{row.soldFromLines}</KasirTd>
              <KasirTd className="text-blue-600 dark:text-blue-400">
                {row.missInputQty || "—"}
              </KasirTd>
              <KasirTd className="text-amber-600 dark:text-amber-400">
                {row.overInputQty || "—"}
              </KasirTd>
            </tr>
          ))}
        </tbody>
      </table>
    </KasirTableShell>
  );
}
