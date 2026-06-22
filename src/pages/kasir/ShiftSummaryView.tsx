import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { InputText } from "../../core/components/forms/InputText";
import { Button } from "../../core/components/ui/Button";
import { LoadingState } from "../../core/components/ui/LoadingState";
import { useAuth } from "../../core/context/AuthContext";
import { useLanguage } from "../../core/context/LanguageContext";
import { formatDateOnly, formatDateTime } from "../../core/utils/formatDate";
import { showProfitDetail } from "../../core/utils/showProfitDetail";
import { ExportShiftButton } from "./ExportShiftButton";
import { ExportShiftPdfButton } from "./ExportShiftPdfButton";
import { SalesByTierTabs, type PriceTierRow } from "./SalesByTierTabs";
import { ShiftCashBreakdown } from "./ShiftCashBreakdown";
import {
  KasirTableShell,
  KasirTd,
  KasirTh,
  kasirTableClass,
  kasirTbodyClass,
  kasirTheadClass,
  kasirTrClass,
} from "./KasirTable";
import { formatRupiah, getShiftDurationDays } from "./utils";

type SummaryTab = "stock" | "receipts" | "expenses" | "deposits" | "income" | "writeoffs";

interface ShiftSummaryViewProps {
  sessionToken: string;
  shiftId: Id<"shifts">;
  onOpenNewShift?: () => void;
  showOpenNewShift?: boolean;
}

export function ShiftSummaryView({
  sessionToken,
  shiftId,
  onOpenNewShift,
  showOpenNewShift = true,
}: ShiftSummaryViewProps) {
  const { translate, language } = useLanguage();
  const { role } = useAuth();
  const showGrossProfit = showProfitDetail(role);
  const [tab, setTab] = useState<SummaryTab>("stock");
  const [productFilter, setProductFilter] = useState("");

  const data = useQuery(api.shifts.getShiftDetail, {
    sessionToken,
    shiftId,
  });

  const filterLower = productFilter.trim().toLowerCase();

  const filteredStockRecon = useMemo(() => {
    if (!data) return [];
    if (!filterLower) return data.stockReconciliation;
    return data.stockReconciliation.filter((row) =>
      row.productName.toLowerCase().includes(filterLower),
    );
  }, [data, filterLower]);

  const filteredSalesTiers = useMemo(() => {
    if (!data) return [];
    if (!filterLower) return data.salesByPriceTier;
    return data.salesByPriceTier.filter((row) =>
      row.productName.toLowerCase().includes(filterLower),
    );
  }, [data, filterLower]);

  const totalProductCount = useMemo(() => {
    if (!data) return 0;
    const names = new Set<string>();
    for (const row of data.stockReconciliation) names.add(row.productName);
    for (const row of data.salesByPriceTier) names.add(row.productName);
    return names.size;
  }, [data]);

  const filteredProductCount = useMemo(() => {
    const names = new Set<string>();
    for (const row of filteredStockRecon) names.add(row.productName);
    for (const row of filteredSalesTiers) names.add(row.productName);
    return names.size;
  }, [filteredStockRecon, filteredSalesTiers]);

  if (!data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-slate-900">
        <LoadingState variant="page" />
      </div>
    );
  }

  const { shift, summary, cashSummary, cashEntries, stockReceipts, writeOffs } =
    data;

  const expenses = cashEntries.filter((e) => e.type === "EXPENSE");
  const deposits = cashEntries.filter((e) => e.type === "DEPOSIT");
  const incomeEntries = cashEntries.filter((e) => e.type === "INCOME");

  const tabs: { id: SummaryTab; label: string; count?: number }[] = [
    {
      id: "stock",
      label: translate("kasirTabStock"),
      count: data.stockReconciliation.length,
    },
    {
      id: "receipts",
      label: translate("kasirTabReceipts"),
      count: stockReceipts.length,
    },
    {
      id: "expenses",
      label: translate("kasirTabExpenses"),
      count: expenses.length,
    },
    {
      id: "deposits",
      label: translate("kasirTabDeposits"),
      count: deposits.length,
    },
    {
      id: "income",
      label: translate("kasirTabIncome"),
      count: incomeEntries.length,
    },
    {
      id: "writeoffs",
      label: translate("kasirTabWriteOffs"),
      count: writeOffs.length,
    },
  ];

  const closedAt = shift.closedAt ?? summary?.closedAt;
  const openingCash = shift.openingCash;
  const expenseTotal = summary?.expenses ?? cashSummary.expenses;
  const depositTotal = summary?.deposits ?? cashSummary.deposits;
  const cashIncome = summary?.cashIncome ?? cashSummary.cashIncome ?? 0;
  const verifiedQris = summary?.verifiedQris ?? cashSummary.verifiedQris;
  const reportedCash = summary?.reportedCash ?? cashSummary.reportedCash;
  const physicalSales =
    data.totalRevenue ?? summary?.totalRevenue ?? summary?.totalSales ?? 0;
  const expectedCashInDrawer =
    openingCash +
    physicalSales +
    cashIncome -
    verifiedQris -
    expenseTotal -
    depositTotal;
  const totalSales = physicalSales;
  const cashVariance = reportedCash - expectedCashInDrawer;
  const recordedQrisSales =
    summary?.recordedQrisSales ??
    summary?.qrisSales ??
    cashSummary.recordedQrisSales ??
    cashSummary.qrisSales ??
    0;
  const recordedRevenue = summary?.recordedRevenue;
  const impliedRevenue = summary?.impliedRevenue;

  const durationDays =
    closedAt && shift.openedAt
      ? getShiftDurationDays(shift.openedAt, closedAt)
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {translate("kasirSummary")}
          </h2>
          <div className="flex shrink-0 gap-2">
            {showGrossProfit && (
              <>
                <ExportShiftButton sessionToken={sessionToken} shiftId={shiftId} />
                <ExportShiftPdfButton
                  sessionToken={sessionToken}
                  shiftId={shiftId}
                />
              </>
            )}
          </div>
        </div>

        <div className="mt-2 space-y-0.5 text-sm text-slate-500">
          <p>
            {translate("kasirShiftOpenedAt")}:{" "}
            {formatDateTime(shift.openedAt, language)}
          </p>
          {closedAt && (
            <p>
              {translate("kasirShiftClosedAt")}:{" "}
              {formatDateTime(closedAt, language)}
            </p>
          )}
          {durationDays !== null && (
            <p>
              {translate("kasirShiftDuration")}:{" "}
              {translate("kasirShiftDays").replace("{days}", String(durationDays))}
            </p>
          )}
          {data.assignedStaffName && (
            <p>
              {translate("kasirOnDuty")}: {data.assignedStaffName}
              {data.closedByName && (
                <>
                  {" "}
                  · {translate("kasirClosedBy")}: {data.closedByName}
                </>
              )}
            </p>
          )}
        </div>

        <div className="mt-4">
          <ShiftCashBreakdown
            openingCash={openingCash}
            totalSales={totalSales}
            cashIncome={cashIncome}
            verifiedQris={verifiedQris}
            recordedQrisSales={recordedQrisSales}
            expenses={expenseTotal}
            deposits={depositTotal}
            expectedCashInDrawer={expectedCashInDrawer}
            reportedCash={reportedCash}
            cashVariance={cashVariance}
            totalRevenue={data.totalRevenue}
            recordedRevenue={recordedRevenue}
            impliedRevenue={impliedRevenue}
            showRevenueBreakdown={showGrossProfit}
            totalCogs={showGrossProfit ? data.totalCogs : undefined}
            grossProfit={showGrossProfit ? data.grossProfit : undefined}
            overInputQtyTotal={summary?.overInputQtyTotal}
            missInputQtyTotal={summary?.missInputQtyTotal}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
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
              {t.count !== undefined && t.count > 0 && (
                <span className="ml-1 text-xs text-slate-400">({t.count})</span>
              )}
            </button>
          ))}
        </div>

        {tab === "stock" && (
          <div className="mt-4">
            <InputText
              label={translate("kasirFilterProduct")}
              value={productFilter}
              onChange={setProductFilter}
              placeholder={translate("kasirFilterProduct")}
              type="search"
            />
            {filterLower && (
              <p className="mt-1 text-xs text-slate-500">
                {translate("kasirFilterProductCount")
                  .replace("{filtered}", String(filteredProductCount))
                  .replace("{total}", String(totalProductCount))}
              </p>
            )}
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          {tab === "stock" && (
            <StockReconTable
              rows={filteredStockRecon}
              salesByPriceTier={filteredSalesTiers}
              showGrossProfit={showGrossProfit}
            />
          )}
          {tab === "receipts" && <ReceiptsTable rows={stockReceipts} />}
          {tab === "expenses" && <CashEntriesTable rows={expenses} />}
          {tab === "deposits" && <CashEntriesTable rows={deposits} />}
          {tab === "income" && <CashEntriesTable rows={incomeEntries} />}
          {tab === "writeoffs" && <WriteOffsTable rows={writeOffs} />}
        </div>
      </div>

      {showOpenNewShift && onOpenNewShift && (
        <Button className="w-full" onClick={onOpenNewShift}>
          {translate("kasirOpenShift")}
        </Button>
      )}
    </div>
  );
}

function StockReconTable({
  rows,
  salesByPriceTier,
  showGrossProfit,
}: {
  rows: Array<{
    productId: Id<"products">;
    productName: string;
    openingQty: number;
    receivedQty: number;
    writeOffQty: number;
    closingQty: number;
    soldQtyFromStock: number;
    soldQtyFromLines: number;
    overInputQty: number;
    missInputQty: number;
  }>;
  salesByPriceTier: PriceTierRow[];
  showGrossProfit: boolean;
}) {
  const { translate } = useLanguage();

  if (rows.length === 0 && salesByPriceTier.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-500">
        {translate("kasirNoData")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <>
          <KasirTableShell>
            <table className={kasirTableClass}>
              <thead className={kasirTheadClass}>
                <tr>
                  <KasirTh>Produk</KasirTh>
                  <KasirTh>{translate("kasirOpeningStock")}</KasirTh>
                  <KasirTh>{translate("kasirReceived")}</KasirTh>
                  <KasirTh>{translate("kasirWriteOff")}</KasirTh>
                  <KasirTh>{translate("kasirClosingStock")}</KasirTh>
                  <KasirTh>{translate("kasirSoldPhysical")}</KasirTh>
                  <KasirTh>{translate("kasirSoldRecorded")}</KasirTh>
                  <KasirTh>{translate("kasirOverInput")}</KasirTh>
                  <KasirTh>{translate("kasirMissInput")}</KasirTh>
                </tr>
              </thead>
              <tbody className={kasirTbodyClass}>
                {rows.map((row) => (
                  <tr key={row.productId} className={kasirTrClass}>
                    <KasirTd className="font-medium text-slate-900 dark:text-white">
                      {row.productName}
                    </KasirTd>
                    <KasirTd>{row.openingQty}</KasirTd>
                    <KasirTd>{row.receivedQty}</KasirTd>
                    <KasirTd>{row.writeOffQty}</KasirTd>
                    <KasirTd>{row.closingQty}</KasirTd>
                    <KasirTd className="font-medium">{row.soldQtyFromStock}</KasirTd>
                    <KasirTd>{row.soldQtyFromLines}</KasirTd>
                    <KasirTd className="text-amber-600 dark:text-amber-400">
                      {row.overInputQty || "—"}
                    </KasirTd>
                    <KasirTd className="text-blue-600 dark:text-blue-400">
                      {row.missInputQty || "—"}
                    </KasirTd>
                  </tr>
                ))}
              </tbody>
            </table>
          </KasirTableShell>
          <p className="text-xs text-slate-500">{translate("kasirRentalNote")}</p>
        </>
      )}

      {salesByPriceTier.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-slate-500">
            {translate("kasirSalesByPrice")}
          </p>
          <SalesByTierTabs
            tiers={salesByPriceTier}
            showGrossProfit={showGrossProfit}
          />
        </div>
      )}
    </div>
  );
}

function ReceiptsTable({
  rows,
}: {
  rows: Array<{
    receiptId: Id<"stockReceipts">;
    createdAt: number;
    supplierName: string;
    note?: string;
    recordedByName: string;
    productName: string;
    productUnit: string;
    qty: number;
    unitCost: number;
    lineTotal: number;
    expiresAt?: number;
  }>;
}) {
  const { translate, language } = useLanguage();

  if (rows.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-500">
        {translate("kasirNoReceipts")}
      </p>
    );
  }

  return (
    <KasirTableShell>
      <table className={kasirTableClass}>
        <thead className={kasirTheadClass}>
          <tr>
            <KasirTh>{translate("kasirDate")}</KasirTh>
            <KasirTh>{translate("kasirSupplier")}</KasirTh>
            <KasirTh>Produk</KasirTh>
            <KasirTh>{translate("kasirQty")}</KasirTh>
            <KasirTh>{translate("kasirUnitCost")}</KasirTh>
            <KasirTh>{translate("kasirLineTotal")}</KasirTh>
            <KasirTh>{translate("kasirExpiryDate")}</KasirTh>
            <KasirTh>{translate("kasirNote")}</KasirTh>
          </tr>
        </thead>
        <tbody className={kasirTbodyClass}>
          {rows.map((row, index) => (
            <tr
              key={`${row.receiptId}-${index}`}
              className={kasirTrClass}
            >
              <KasirTd className="whitespace-nowrap">
                {formatDateTime(row.createdAt, language)}
              </KasirTd>
              <KasirTd>{row.supplierName}</KasirTd>
              <KasirTd>
                {row.productName}
                {row.productUnit ? ` (${row.productUnit})` : ""}
              </KasirTd>
              <KasirTd>{row.qty}</KasirTd>
              <KasirTd>{formatRupiah(row.unitCost)}</KasirTd>
              <KasirTd>{formatRupiah(row.lineTotal)}</KasirTd>
              <KasirTd>
                {row.expiresAt
                  ? formatDateOnly(row.expiresAt, language)
                  : "—"}
              </KasirTd>
              <KasirTd className="max-w-[120px] truncate">{row.note ?? "—"}</KasirTd>
            </tr>
          ))}
        </tbody>
      </table>
    </KasirTableShell>
  );
}

function CashEntriesTable({
  rows,
}: {
  rows: Array<{
    _id: Id<"cashEntries">;
    amount: number;
    note: string;
    createdAt: number;
    recordedByName: string;
  }>;
}) {
  const { translate, language } = useLanguage();

  if (rows.length === 0) {
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
            <KasirTh>{translate("kasirDate")}</KasirTh>
            <KasirTh>{translate("kasirPayTotal")}</KasirTh>
            <KasirTh>{translate("kasirNote")}</KasirTh>
            <KasirTh>{translate("kasirRecordedBy")}</KasirTh>
          </tr>
        </thead>
        <tbody className={kasirTbodyClass}>
          {rows.map((row) => (
            <tr key={row._id} className={kasirTrClass}>
              <KasirTd className="whitespace-nowrap">
                {formatDateTime(row.createdAt, language)}
              </KasirTd>
              <KasirTd className="font-medium">{formatRupiah(row.amount)}</KasirTd>
              <KasirTd>{row.note}</KasirTd>
              <KasirTd>{row.recordedByName}</KasirTd>
            </tr>
          ))}
        </tbody>
      </table>
    </KasirTableShell>
  );
}

function WriteOffsTable({
  rows,
}: {
  rows: Array<{
    _id: Id<"stockMovements">;
    productName: string;
    productUnit: string;
    qty: number;
    note: string;
    createdAt: number;
    recordedByName: string;
  }>;
}) {
  const { translate, language } = useLanguage();

  if (rows.length === 0) {
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
            <KasirTh>{translate("kasirDate")}</KasirTh>
            <KasirTh>Produk</KasirTh>
            <KasirTh>{translate("kasirQty")}</KasirTh>
            <KasirTh>{translate("kasirNote")}</KasirTh>
            <KasirTh>{translate("kasirRecordedBy")}</KasirTh>
          </tr>
        </thead>
        <tbody className={kasirTbodyClass}>
          {rows.map((row) => (
            <tr key={row._id} className={kasirTrClass}>
              <KasirTd className="whitespace-nowrap">
                {formatDateTime(row.createdAt, language)}
              </KasirTd>
              <KasirTd>
                {row.productName}
                {row.productUnit ? ` (${row.productUnit})` : ""}
              </KasirTd>
              <KasirTd>{row.qty}</KasirTd>
              <KasirTd>{row.note}</KasirTd>
              <KasirTd>{row.recordedByName}</KasirTd>
            </tr>
          ))}
        </tbody>
      </table>
    </KasirTableShell>
  );
}
