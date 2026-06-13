import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../../core/components/ui/Button";
import { useLanguage } from "../../core/context/LanguageContext";
import { useToast } from "../../core/context/ToastContext";
import { ExportShiftButton } from "./ExportShiftButton";
import { ShiftCashBreakdown } from "./ShiftCashBreakdown";
import { formatRupiah } from "./utils";

type SummaryTab = "stock" | "receipts" | "expenses" | "deposits";

interface ShiftSummaryViewProps {
  sessionToken: string;
  shiftId: Id<"shifts">;
  onOpenNewShift?: () => void;
  onBack?: () => void;
  showOpenNewShift?: boolean;
}

export function ShiftSummaryView({
  sessionToken,
  shiftId,
  onOpenNewShift,
  onBack,
  showOpenNewShift = true,
}: ShiftSummaryViewProps) {
  const { translate } = useLanguage();
  const { showToast } = useToast();
  const archiveShift = useMutation(api.shifts.archiveShift);
  const [tab, setTab] = useState<SummaryTab>("stock");

  const data = useQuery(api.shifts.getShiftDetail, {
    sessionToken,
    shiftId,
  });

  const handleArchive = async () => {
    try {
      await archiveShift({ sessionToken, shiftId });
      showToast({
        type: "success",
        message: translate("kasirArchiveSuccess"),
      });
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: translate("unexpectedError") });
    }
  };

  if (!data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <p className="text-slate-500">{translate("loading")}</p>
      </div>
    );
  }

  const { shift, summary, cashSummary, cashEntries, stockReceipts, stockReconciliation } =
    data;

  const expenses = cashEntries.filter((e) => e.type === "EXPENSE");
  const deposits = cashEntries.filter((e) => e.type === "DEPOSIT");

  const tabs: { id: SummaryTab; label: string; count?: number }[] = [
    { id: "stock", label: translate("kasirTabStock"), count: stockReconciliation.length },
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
  ];

  const closedAt = shift.closedAt ?? summary?.closedAt;
  const openingCash = shift.openingCash;
  const totalSales =
    summary?.totalSales ?? cashSummary.totalSales ?? data.totalRevenue;
  const verifiedQris = summary?.verifiedQris ?? cashSummary.verifiedQris;
  const reportedCash = summary?.reportedCash ?? cashSummary.reportedCash;
  const expectedCashInDrawer =
    summary?.expectedCashInDrawer ?? cashSummary.expectedCashInDrawer;
  const cashVariance = summary?.cashVariance ?? cashSummary.cashVariance;
  const expenseTotal = summary?.expenses ?? cashSummary.expenses;
  const depositTotal = summary?.deposits ?? cashSummary.deposits;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack}>
          {translate("kasirBack")}
        </Button>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {translate("kasirSummary")}
        </h2>
        {closedAt && (
          <p className="mt-1 text-sm text-slate-500">
            {new Date(closedAt).toLocaleString("id-ID")}
          </p>
        )}
        {data.assignedStaffName && (
          <p className="text-sm text-slate-500">
            {translate("kasirOnDuty")}: {data.assignedStaffName}
            {data.closedByName && (
              <>
                {" "}
                · {translate("kasirClosedBy")}: {data.closedByName}
              </>
            )}
          </p>
        )}

        <div className="mt-4">
          <ShiftCashBreakdown
            openingCash={openingCash}
            totalSales={totalSales}
            verifiedQris={verifiedQris}
            expenses={expenseTotal}
            deposits={depositTotal}
            expectedCashInDrawer={expectedCashInDrawer}
            reportedCash={reportedCash}
            cashVariance={cashVariance}
            totalRevenue={data.totalRevenue}
            totalCogs={data.totalCogs}
            grossProfit={data.grossProfit}
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

        <div className="mt-4 overflow-x-auto">
          {tab === "stock" && (
            <StockReconTable rows={stockReconciliation} salesByPriceTier={data.salesByPriceTier} />
          )}
          {tab === "receipts" && (
            <ReceiptsTable rows={stockReceipts} />
          )}
          {tab === "expenses" && <CashEntriesTable rows={expenses} />}
          {tab === "deposits" && <CashEntriesTable rows={deposits} />}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <ExportShiftButton sessionToken={sessionToken} shiftId={shiftId} />
          <Button variant="outline" size="sm" onClick={handleArchive}>
            {translate("kasirArchiveShift")}
          </Button>
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
  salesByPriceTier: Array<{
    productId: Id<"products">;
    productName: string;
    unitPrice: number;
    qty: number;
    revenue: number;
  }>;
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
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left dark:bg-slate-800">
            <tr>
              <th className="px-3 py-2">Produk</th>
              <th className="px-3 py-2">{translate("kasirOpeningStock")}</th>
              <th className="px-3 py-2">{translate("kasirReceived")}</th>
              <th className="px-3 py-2">{translate("kasirWriteOff")}</th>
              <th className="px-3 py-2">{translate("kasirClosingStock")}</th>
              <th className="px-3 py-2">{translate("kasirSoldPhysical")}</th>
              <th className="px-3 py-2">{translate("kasirSoldRecorded")}</th>
              <th className="px-3 py-2">{translate("kasirOverInput")}</th>
              <th className="px-3 py-2">{translate("kasirMissInput")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.productId}
                className="border-t border-slate-100 dark:border-slate-800"
              >
                <td className="px-3 py-2">{row.productName}</td>
                <td className="px-3 py-2">{row.openingQty}</td>
                <td className="px-3 py-2">{row.receivedQty}</td>
                <td className="px-3 py-2">{row.writeOffQty}</td>
                <td className="px-3 py-2">{row.closingQty}</td>
                <td className="px-3 py-2 font-medium">{row.soldQtyFromStock}</td>
                <td className="px-3 py-2">{row.soldQtyFromLines}</td>
                <td className="px-3 py-2 text-amber-600">{row.overInputQty || "—"}</td>
                <td className="px-3 py-2 text-blue-600">{row.missInputQty || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {salesByPriceTier.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-slate-500">
            {translate("kasirSalesByPrice")}
          </p>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2">Produk</th>
                <th className="px-3 py-2">{translate("kasirPriceTier")}</th>
                <th className="px-3 py-2">{translate("kasirSoldQty")}</th>
                <th className="px-3 py-2">{translate("kasirRevenue")}</th>
              </tr>
            </thead>
            <tbody>
              {salesByPriceTier.map((tier) => (
                <tr
                  key={`${tier.productId}-${tier.unitPrice}`}
                  className="border-t border-slate-100 dark:border-slate-800"
                >
                  <td className="px-3 py-2">{tier.productName}</td>
                  <td className="px-3 py-2">{formatRupiah(tier.unitPrice)}</td>
                  <td className="px-3 py-2">{tier.qty}</td>
                  <td className="px-3 py-2">{formatRupiah(tier.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
  const { translate } = useLanguage();

  if (rows.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-500">
        {translate("kasirNoReceipts")}
      </p>
    );
  }

  return (
    <table className="min-w-full text-sm">
      <thead className="bg-slate-50 text-left dark:bg-slate-800">
        <tr>
          <th className="px-3 py-2">{translate("kasirDate")}</th>
          <th className="px-3 py-2">{translate("kasirSupplier")}</th>
          <th className="px-3 py-2">Produk</th>
          <th className="px-3 py-2">{translate("kasirQty")}</th>
          <th className="px-3 py-2">{translate("kasirUnitCost")}</th>
          <th className="px-3 py-2">{translate("kasirLineTotal")}</th>
          <th className="px-3 py-2">{translate("kasirExpiryDate")}</th>
          <th className="px-3 py-2">{translate("kasirNote")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={`${row.receiptId}-${index}`}
            className="border-t border-slate-100 dark:border-slate-800"
          >
            <td className="px-3 py-2 whitespace-nowrap">
              {new Date(row.createdAt).toLocaleString("id-ID")}
            </td>
            <td className="px-3 py-2">{row.supplierName}</td>
            <td className="px-3 py-2">
              {row.productName}
              {row.productUnit ? ` (${row.productUnit})` : ""}
            </td>
            <td className="px-3 py-2">{row.qty}</td>
            <td className="px-3 py-2">{formatRupiah(row.unitCost)}</td>
            <td className="px-3 py-2">{formatRupiah(row.lineTotal)}</td>
            <td className="px-3 py-2">
              {row.expiresAt
                ? new Date(row.expiresAt).toLocaleDateString("id-ID")
                : "—"}
            </td>
            <td className="px-3 py-2 max-w-[120px] truncate">{row.note ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
  const { translate } = useLanguage();

  if (rows.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-500">
        {translate("kasirNoData")}
      </p>
    );
  }

  return (
    <table className="min-w-full text-sm">
      <thead className="bg-slate-50 text-left dark:bg-slate-800">
        <tr>
          <th className="px-3 py-2">{translate("kasirDate")}</th>
          <th className="px-3 py-2">{translate("kasirPayTotal")}</th>
          <th className="px-3 py-2">{translate("kasirNote")}</th>
          <th className="px-3 py-2">{translate("kasirRecordedBy")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row._id}
            className="border-t border-slate-100 dark:border-slate-800"
          >
            <td className="px-3 py-2 whitespace-nowrap">
              {new Date(row.createdAt).toLocaleString("id-ID")}
            </td>
            <td className="px-3 py-2 font-medium">{formatRupiah(row.amount)}</td>
            <td className="px-3 py-2">{row.note}</td>
            <td className="px-3 py-2">{row.recordedByName}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
