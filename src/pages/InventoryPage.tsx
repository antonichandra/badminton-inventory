import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { InputText } from "../core/components/forms/InputText";
import { PageHeader } from "../core/components/PageHeader";
import { PermissionGuard } from "../core/components/PermissionGuard";
import { LoadingState } from "../core/components/ui/LoadingState";
import { useAuth } from "../core/context/AuthContext";
import { useBusiness } from "../core/context/BusinessContext";
import { useLanguage } from "../core/context/LanguageContext";
import { formatDateOnly } from "../core/utils/formatDate";
import { showProfitDetail } from "../core/utils/showProfitDetail";
import {
  KasirTableShell,
  KasirTd,
  KasirTh,
  kasirTableClass,
  kasirTbodyClass,
  kasirTdClass,
  kasirTheadClass,
  kasirTrClass,
} from "./kasir/KasirTable";
import { formatRupiah } from "./kasir/utils";

export function InventoryPage() {
  const { translate, language } = useLanguage();
  const { sessionToken, role } = useAuth();
  const { activeBusinessId } = useBusiness();
  const showCost = showProfitDetail(role);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const inventoryData = useQuery(
    api.reports.getInventoryStock,
    sessionToken
      ? {
          sessionToken,
          businessId: activeBusinessId ?? undefined,
          search: search.trim() || undefined,
        }
      : "skip",
  );

  const inventory = inventoryData?.products ?? [];
  const hasOpenShift = inventoryData?.hasOpenShift ?? false;

  const totalProducts = inventory.length;
  const totalQtyEstimated = useMemo(
    () => inventory.reduce((sum, row) => sum + row.qtyEstimated, 0),
    [inventory],
  );

  const toggleExpanded = (productId: Id<"products">) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      const key = productId;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <PermissionGuard permission="kasir">
      <PageHeader
        title={translate("inventoryPageTitle")}
        subtitle={translate("inventoryPageSubtitle")}
      />

      <div className="mb-4 max-w-md">
        <InputText
          label={translate("productFilterSearch")}
          value={search}
          onChange={setSearch}
          placeholder={translate("inventorySearchPlaceholder")}
          type="search"
        />
      </div>

      {inventoryData === undefined ? (
        <LoadingState variant="page" className="py-12" />
      ) : inventory.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <p className="text-slate-500">{translate("inventoryEmpty")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-slate-500">
            <p>
              {translate("inventorySummary")
                .replace("{products}", String(totalProducts))
                .replace("{qty}", String(totalQtyEstimated))}
            </p>
            {hasOpenShift && (
              <p className="mt-1 text-xs">{translate("inventoryEstimatedHint")}</p>
            )}
          </div>

          <KasirTableShell>
            <table className={kasirTableClass}>
              <thead className={kasirTheadClass}>
                <tr>
                  <KasirTh className="w-10">
                    <span className="sr-only">Expand</span>
                  </KasirTh>
                  <KasirTh>{translate("inventoryColProduct")}</KasirTh>
                  <KasirTh>{translate("inventoryColQtyOnHand")}</KasirTh>
                  <KasirTh>{translate("inventoryColQtyEstimated")}</KasirTh>
                  <KasirTh>{translate("inventoryColSellPrice")}</KasirTh>
                </tr>
              </thead>
              <tbody className={kasirTbodyClass}>
                {inventory.map((row) => (
                  <ProductStockRows
                    key={row.productId}
                    row={row}
                    isOpen={expanded.has(row.productId)}
                    language={language}
                    showCost={showCost}
                    onToggle={() => toggleExpanded(row.productId)}
                    translate={translate}
                  />
                ))}
              </tbody>
            </table>
          </KasirTableShell>
        </div>
      )}
    </PermissionGuard>
  );
}

function qtyToneClass(qty: number) {
  if (qty === 0) return "font-semibold text-red-600 dark:text-red-400";
  if (qty <= 5) return "font-semibold text-amber-700 dark:text-amber-400";
  return "font-medium text-slate-900 dark:text-white";
}

function ProductStockRows({
  row,
  isOpen,
  language,
  showCost,
  onToggle,
  translate,
}: {
  row: {
    productId: Id<"products">;
    productName: string;
    unit: string;
    sellPrice: number;
    qtyOnHand: number;
    qtyEstimated: number;
    batches: Array<{
      batchId: Id<"stockReceiptItems">;
      qty: number;
      qtyRemaining: number;
      unitCost: number;
      expiresAt?: number;
      receivedAt: number;
      supplierName: string;
    }>;
  };
  isOpen: boolean;
  language: "ID" | "EN";
  showCost: boolean;
  onToggle: () => void;
  translate: (key: import("../core/i18n").TranslationKey) => string;
}) {
  return (
    <>
      <tr className={kasirTrClass}>
        <KasirTd>
          <button
            type="button"
            onClick={onToggle}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-expanded={isOpen}
            aria-label={row.productName}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </KasirTd>
        <KasirTd className="font-medium text-slate-900 dark:text-white">
          {row.productName}
          <span className="ml-1 text-xs font-normal text-slate-500">
            ({row.unit})
          </span>
        </KasirTd>
        <KasirTd className={qtyToneClass(row.qtyOnHand)}>
          {row.qtyOnHand} {row.unit}
        </KasirTd>
        <KasirTd className={qtyToneClass(row.qtyEstimated)}>
          {row.qtyEstimated} {row.unit}
        </KasirTd>
        <KasirTd>{formatRupiah(row.sellPrice)}</KasirTd>
      </tr>

      {isOpen && (
        <tr className="bg-slate-50/80 dark:bg-slate-800/30">
          <td colSpan={5} className={`${kasirTdClass} !py-3`}>
            {row.batches.length === 0 ? (
              <p className="px-2 text-sm text-slate-500">
                {translate("inventoryNoBatches")}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                        {translate("inventoryBatchSupplier")}
                      </th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                        {translate("inventoryBatchQty")}
                      </th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                        {translate("inventoryBatchRemaining")}
                      </th>
                      {showCost && (
                        <th className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                          {translate("inventoryBatchCost")}
                        </th>
                      )}
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                        {translate("inventoryBatchReceived")}
                      </th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                        {translate("inventoryBatchExpiry")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.batches.map((batch) => (
                      <tr
                        key={batch.batchId}
                        className="border-t border-slate-100 dark:border-slate-800"
                      >
                        <td className="px-3 py-2">{batch.supplierName}</td>
                        <td className="px-3 py-2">{batch.qty}</td>
                        <td className="px-3 py-2 font-medium">
                          {batch.qtyRemaining}
                        </td>
                        {showCost && (
                          <td className="px-3 py-2">
                            {formatRupiah(batch.unitCost)}
                          </td>
                        )}
                        <td className="px-3 py-2">
                          {formatDateOnly(batch.receivedAt, language)}
                        </td>
                        <td className="px-3 py-2">
                          {batch.expiresAt
                            ? formatDateOnly(batch.expiresAt, language)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
