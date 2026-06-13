import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { DataTable } from "../../../core/components/table/DataTable";
import { Button } from "../../../core/components/ui/Button";
import { useBusiness } from "../../../core/context/BusinessContext";
import { useLanguage } from "../../../core/context/LanguageContext";
import { useToast } from "../../../core/context/ToastContext";
import {
  buildSupplierReceiptTableColumns,
  type SupplierReceiptPaymentFilter,
  type SupplierReceiptRow,
} from "./suppliers.config";
import { SupplierReceiptDetailSheet } from "./SupplierReceiptDetailSheet";

interface SupplierReceiptsPanelProps {
  sessionToken: string;
}

export function SupplierReceiptsPanel({ sessionToken }: SupplierReceiptsPanelProps) {
  const { translate, language } = useLanguage();
  const { activeBusinessId } = useBusiness();
  const { showToast } = useToast();
  const markPaid = useMutation(api.shifts.markStockReceiptPaid);

  const [paymentFilter, setPaymentFilter] =
    useState<SupplierReceiptPaymentFilter>("ALL");
  const [markingId, setMarkingId] = useState<Id<"stockReceipts"> | null>(null);
  const [detailReceiptId, setDetailReceiptId] =
    useState<Id<"stockReceipts"> | null>(null);

  const receipts = useQuery(
    api.shifts.listStockReceipts,
    sessionToken && activeBusinessId
      ? {
          sessionToken,
          businessId: activeBusinessId,
          paymentStatus:
            paymentFilter === "ALL" ? undefined : paymentFilter,
        }
      : "skip",
  );

  const handleMarkPaid = useCallback(
    async (row: SupplierReceiptRow) => {
      setMarkingId(row._id);
      try {
        await markPaid({ sessionToken, receiptId: row._id });
        showToast({
          type: "success",
          message: translate("supplierReceiptMarkPaidSuccess"),
        });
      } catch (error) {
        console.error(error);
        showToast({ type: "error", message: translate("unexpectedError") });
      } finally {
        setMarkingId(null);
      }
    },
    [markPaid, sessionToken, showToast, translate],
  );

  const columns = useMemo(
    () =>
      buildSupplierReceiptTableColumns(
        {
          date: translate("supplierReceiptDate"),
          supplier: translate("supplierColName"),
          total: translate("supplierReceiptTotal"),
          due: translate("supplierReceiptDue"),
          status: translate("supplierReceiptPaymentStatus"),
          unpaid: translate("supplierReceiptUnpaid"),
          paid: translate("supplierReceiptPaid"),
          overdue: translate("supplierReceiptOverdue"),
          markPaid: translate("supplierReceiptMarkPaid"),
          detail: translate("supplierReceiptDetail"),
        },
        language,
        handleMarkPaid,
        (row) => setDetailReceiptId(row._id),
        markingId,
      ),
    [handleMarkPaid, language, markingId, translate],
  );

  const filterOptions: { value: SupplierReceiptPaymentFilter; label: string }[] =
    [
      { value: "ALL", label: translate("supplierReceiptFilterAll") },
      { value: "UNPAID", label: translate("supplierReceiptUnpaid") },
      { value: "PAID", label: translate("supplierReceiptPaid") },
    ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={paymentFilter === option.value ? "primary" : "outline"}
            onClick={() => setPaymentFilter(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={receipts ?? []}
        getRowKey={(row) => row._id}
        emptyMessage={translate("supplierReceiptEmpty")}
        isLoading={receipts === undefined}
      />

      <SupplierReceiptDetailSheet
        open={detailReceiptId !== null}
        onClose={() => setDetailReceiptId(null)}
        sessionToken={sessionToken}
        receiptId={detailReceiptId}
        onMarkPaid={handleMarkPaid}
        markingId={markingId}
      />
    </div>
  );
}
