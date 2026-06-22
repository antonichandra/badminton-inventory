import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { InputDate } from "../core/components/forms/InputDate";
import { InputText } from "../core/components/forms/InputText";
import { PageHeader } from "../core/components/PageHeader";
import { PermissionGuard } from "../core/components/PermissionGuard";
import { Button } from "../core/components/ui/Button";
import { LoadingState } from "../core/components/ui/LoadingState";
import { Modal } from "../core/components/ui/Modal";
import { useAuth } from "../core/context/AuthContext";
import { useBusiness } from "../core/context/BusinessContext";
import { useLanguage } from "../core/context/LanguageContext";
import { useToast } from "../core/context/ToastContext";
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

type StockAlert = "empty" | "low" | "ok";

interface EditingBatch {
  batchId: Id<"stockReceiptItems">;
  productName: string;
  supplierName: string;
  trackExpiry: boolean;
  expiresAt?: number;
}

function toDateInputValue(timestamp?: number): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromDateInputValue(value: string): number | undefined {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00`).getTime();
}

export function InventoryPage() {
  const { translate, language } = useLanguage();
  const { sessionToken, role } = useAuth();
  const { activeBusinessId } = useBusiness();
  const showCost = showProfitDetail(role);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingBatch, setEditingBatch] = useState<EditingBatch | null>(null);

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
  const attentionCount = useMemo(
    () =>
      inventory.filter(
        (row) => row.stockAlert === "empty" || row.stockAlert === "low",
      ).length,
    [inventory],
  );
  const showExpiryColumn = useMemo(
    () => inventory.some((row) => row.trackExpiry),
    [inventory],
  );
  const mainTableColCount = showExpiryColumn ? 7 : 6;

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
            {attentionCount > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {translate("inventoryAttentionCount").replace(
                  "{count}",
                  String(attentionCount),
                )}
              </p>
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
                  <KasirTh>{translate("inventoryColStatus")}</KasirTh>
                  <KasirTh>{translate("inventoryColQtyOnHand")}</KasirTh>
                  <KasirTh>{translate("inventoryColQtyEstimated")}</KasirTh>
                  {showExpiryColumn && (
                    <KasirTh>{translate("inventoryColNearestExpiry")}</KasirTh>
                  )}
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
                    showExpiryColumn={showExpiryColumn}
                    mainTableColCount={mainTableColCount}
                    onToggle={() => toggleExpanded(row.productId)}
                    onEditBatch={(batch) =>
                      setEditingBatch({
                        batchId: batch.batchId,
                        productName: row.productName,
                        supplierName: batch.supplierName,
                        trackExpiry: row.trackExpiry ?? false,
                        expiresAt: batch.expiresAt,
                      })
                    }
                    translate={translate}
                  />
                ))}
              </tbody>
            </table>
          </KasirTableShell>
        </div>
      )}

      {sessionToken && (
        <EditBatchExpiryModal
          open={editingBatch != null}
          batch={editingBatch}
          sessionToken={sessionToken}
          onClose={() => setEditingBatch(null)}
        />
      )}
    </PermissionGuard>
  );
}

function EditBatchExpiryModal({
  open,
  batch,
  sessionToken,
  onClose,
}: {
  open: boolean;
  batch: EditingBatch | null;
  sessionToken: string;
  onClose: () => void;
}) {
  const { translate } = useLanguage();
  const { showToast } = useToast();
  const updateExpiry = useMutation(api.reports.updateStockBatchExpiry);
  const [expiryDate, setExpiryDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (batch) {
      setExpiryDate(toDateInputValue(batch.expiresAt));
    }
  }, [batch?.batchId, batch?.expiresAt]);

  const handleSave = async () => {
    if (!batch) return;

    if (batch.trackExpiry && !expiryDate) {
      showToast({ type: "error", message: translate("kasirExpiryRequired") });
      return;
    }

    const expiresAt = expiryDate ? fromDateInputValue(expiryDate) : null;

    setIsSaving(true);
    try {
      await updateExpiry({
        sessionToken,
        batchId: batch.batchId,
        expiresAt: expiresAt ?? null,
      });
      showToast({
        type: "success",
        message: translate("inventoryExpiryUpdated"),
      });
      onClose();
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: translate("unexpectedError") });
    } finally {
      setIsSaving(false);
    }
  };

  const description = batch
    ? translate("inventoryEditExpiryDesc")
        .replace("{product}", batch.productName)
        .replace("{supplier}", batch.supplierName)
    : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={translate("inventoryEditExpiryTitle")}
      description={description}
      size="sm"
      closeOnBackdrop={!isSaving}
      showCloseButton={!isSaving}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            {translate("cancel")}
          </Button>
          {!batch?.trackExpiry && (
            <Button
              variant="ghost"
              disabled={isSaving}
              onClick={async () => {
                if (!batch) return;
                setIsSaving(true);
                try {
                  await updateExpiry({
                    sessionToken,
                    batchId: batch.batchId,
                    expiresAt: null,
                  });
                  showToast({
                    type: "success",
                    message: translate("inventoryExpiryUpdated"),
                  });
                  onClose();
                } catch (error) {
                  console.error(error);
                  showToast({
                    type: "error",
                    message: translate("unexpectedError"),
                  });
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              {translate("inventoryClearExpiry")}
            </Button>
          )}
          <Button onClick={handleSave} loading={isSaving}>
            {translate("inventoryExpirySave")}
          </Button>
        </>
      }
    >
      <InputDate
        label={translate("kasirExpiryDate")}
        value={expiryDate}
        onChange={setExpiryDate}
        required={batch?.trackExpiry}
      />
    </Modal>
  );
}

function qtyToneClass(qty: number) {
  if (qty === 0) return "font-semibold text-red-600 dark:text-red-400";
  if (qty <= 5) return "font-semibold text-amber-700 dark:text-amber-400";
  return "font-medium text-slate-900 dark:text-white";
}

function rowAlertClass(alert: StockAlert) {
  if (alert === "empty") {
    return "bg-red-50/80 dark:bg-red-950/20";
  }
  if (alert === "low") {
    return "bg-amber-50/60 dark:bg-amber-950/15";
  }
  return "";
}

function StockStatusBadge({
  alert,
  translate,
}: {
  alert: StockAlert;
  translate: (key: import("../core/i18n").TranslationKey) => string;
}) {
  if (alert === "empty") {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/50 dark:text-red-300">
        {translate("inventoryStockEmpty")}
      </span>
    );
  }
  if (alert === "low") {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
        {translate("inventoryStockLow")}
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
      {translate("inventoryStockOk")}
    </span>
  );
}

function ProductStockRows({
  row,
  isOpen,
  language,
  showCost,
  showExpiryColumn,
  mainTableColCount,
  onToggle,
  onEditBatch,
  translate,
}: {
  row: {
    productId: Id<"products">;
    productName: string;
    unit: string;
    sellPrice: number;
    trackExpiry?: boolean;
    qtyOnHand: number;
    qtyEstimated: number;
    stockAlert: StockAlert;
    nearestExpiresAt?: number;
    batches: Array<{
      batchId: Id<"stockReceiptItems">;
      qty: number;
      qtyRemaining: number;
      unitCost?: number;
      expiresAt?: number;
      receivedAt: number;
      supplierName: string;
    }>;
  };
  isOpen: boolean;
  language: "ID" | "EN";
  showCost: boolean;
  showExpiryColumn: boolean;
  mainTableColCount: number;
  onToggle: () => void;
  onEditBatch: (batch: {
    batchId: Id<"stockReceiptItems">;
    supplierName: string;
    expiresAt?: number;
  }) => void;
  translate: (key: import("../core/i18n").TranslationKey) => string;
}) {
  const trackExpiry = row.trackExpiry ?? false;
  const expirySoon =
    trackExpiry &&
    row.nearestExpiresAt != null &&
    row.nearestExpiresAt <= Date.now() + 14 * 24 * 60 * 60 * 1000;

  return (
    <>
      <tr className={`${kasirTrClass} ${rowAlertClass(row.stockAlert)}`}>
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
        <KasirTd>
          <StockStatusBadge alert={row.stockAlert} translate={translate} />
        </KasirTd>
        <KasirTd className={qtyToneClass(row.qtyOnHand)}>
          {row.qtyOnHand} {row.unit}
        </KasirTd>
        <KasirTd className={qtyToneClass(row.qtyEstimated)}>
          {row.qtyEstimated} {row.unit}
        </KasirTd>
        {showExpiryColumn && (
          <KasirTd
            className={
              trackExpiry && expirySoon
                ? "font-medium text-amber-700 dark:text-amber-400"
                : "text-slate-700 dark:text-slate-300"
            }
          >
            {trackExpiry && row.nearestExpiresAt
              ? formatDateOnly(row.nearestExpiresAt, language)
              : "—"}
          </KasirTd>
        )}
        <KasirTd>{formatRupiah(row.sellPrice)}</KasirTd>
      </tr>

      {isOpen && (
        <tr className="bg-slate-50/80 dark:bg-slate-800/30">
          <td colSpan={mainTableColCount} className={`${kasirTdClass} !py-3`}>
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
                      {trackExpiry && (
                        <th className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                          {translate("inventoryBatchExpiry")}
                        </th>
                      )}
                      {trackExpiry && (
                        <th className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                          {translate("inventoryBatchActions")}
                        </th>
                      )}
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
                            {batch.unitCost != null
                              ? formatRupiah(batch.unitCost)
                              : "—"}
                          </td>
                        )}
                        <td className="px-3 py-2">
                          {formatDateOnly(batch.receivedAt, language)}
                        </td>
                        {trackExpiry && (
                          <td className="px-3 py-2">
                            {batch.expiresAt
                              ? formatDateOnly(batch.expiresAt, language)
                              : "—"}
                          </td>
                        )}
                        {trackExpiry && (
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => onEditBatch(batch)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                              title={translate("inventoryEditExpiry")}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">
                                {translate("inventoryEditExpiry")}
                              </span>
                            </button>
                          </td>
                        )}
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
