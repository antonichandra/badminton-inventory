import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, Pencil } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { formatDateOnly, formatDateTime } from "../../../core/utils/formatDate";
import { InputNumber } from "../../../core/components/forms/InputNumber";
import { BottomSheet } from "../../../core/components/ui/BottomSheet";
import { Button } from "../../../core/components/ui/Button";
import { LoadingState } from "../../../core/components/ui/LoadingState";
import { Badge } from "../../../core/components/table/Badge";
import { useLanguage } from "../../../core/context/LanguageContext";
import { useToast } from "../../../core/context/ToastContext";
import { formatRupiah } from "../../kasir/utils";
import type { SupplierReceiptRow } from "./suppliers.config";

interface SupplierReceiptDetailSheetProps {
  open: boolean;
  onClose: () => void;
  sessionToken: string;
  receiptId: Id<"stockReceipts"> | null;
  onMarkPaid?: (row: SupplierReceiptRow) => void;
  markingId?: Id<"stockReceipts"> | null;
}

export function SupplierReceiptDetailSheet({
  open,
  onClose,
  sessionToken,
  receiptId,
  onMarkPaid,
  markingId,
}: SupplierReceiptDetailSheetProps) {
  const { translate, language } = useLanguage();
  const { showToast } = useToast();
  const markPaid = useMutation(api.shifts.markStockReceiptPaid);
  const updateCosts = useMutation(api.shifts.updateStockReceiptItemCosts);

  const detail = useQuery(
    api.shifts.getStockReceiptDetail,
    open && receiptId ? { sessionToken, receiptId } : "skip",
  );

  const [isEditing, setIsEditing] = useState(false);
  const [costByItem, setCostByItem] = useState<Record<string, string>>({});
  const [isSavingCosts, setIsSavingCosts] = useState(false);

  useEffect(() => {
    if (!detail) return;
    setCostByItem(
      Object.fromEntries(
        detail.items.map((item) => [item.itemId, String(item.unitCost)]),
      ),
    );
    setIsEditing(false);
  }, [detail?._id, detail?.items]);

  const handleMarkPaid = async () => {
    if (!receiptId) return;
    try {
      await markPaid({ sessionToken, receiptId });
      showToast({
        type: "success",
        message: translate("supplierReceiptMarkPaidSuccess"),
      });
      onClose();
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: translate("unexpectedError") });
    }
  };

  const handleSaveCosts = async () => {
    if (!receiptId || !detail) return;

    setIsSavingCosts(true);
    try {
      await updateCosts({
        sessionToken,
        receiptId,
        items: detail.items.map((item) => ({
          itemId: item.itemId,
          unitCost: Number(costByItem[item.itemId] ?? "0") || 0,
        })),
      });
      showToast({
        type: "success",
        message: translate("supplierReceiptCostsUpdated"),
      });
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: translate("unexpectedError") });
    } finally {
      setIsSavingCosts(false);
    }
  };

  const footer = detail ? (
    <div className="flex flex-col gap-2">
      {isEditing ? (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => setIsEditing(false)}
            disabled={isSavingCosts}
          >
            {translate("cancel")}
          </Button>
          <Button
            className="flex-1"
            onClick={() => void handleSaveCosts()}
            loading={isSavingCosts}
          >
            {translate("supplierReceiptSaveCosts")}
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          leftIcon={<Pencil className="h-4 w-4" />}
          onClick={() => setIsEditing(true)}
        >
          {translate("supplierReceiptEditCosts")}
        </Button>
      )}
      {detail.supplierPaymentStatus === "UNPAID" && !isEditing && (
        <Button
          className="w-full"
          variant="primary"
          leftIcon={<Check className="h-4 w-4" />}
          loading={markingId === receiptId}
          onClick={() => {
            if (onMarkPaid && detail) {
              onMarkPaid({
                _id: detail._id,
                createdAt: detail.createdAt,
                supplierId: detail.supplierId,
                supplierName: detail.supplierName,
                totalAmount: detail.totalAmount,
                dueAt: detail.dueAt,
                supplierPaymentStatus: detail.supplierPaymentStatus,
                paidAt: detail.paidAt,
                shiftId: detail.shiftId,
                itemCount: detail.items.length,
                note: detail.note,
              });
            } else {
              void handleMarkPaid();
            }
          }}
        >
          {translate("supplierReceiptMarkPaid")}
        </Button>
      )}
    </div>
  ) : undefined;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={translate("supplierReceiptDetail")}
      footer={footer}
    >
      {!detail ? (
        <LoadingState variant="sheet" />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800">
            <p>
              <span className="text-slate-500">{translate("supplierColName")}:</span>{" "}
              {detail.supplierName}
            </p>
            <p>
              <span className="text-slate-500">{translate("supplierReceiptDate")}:</span>{" "}
              {formatDateTime(detail.createdAt, language)}
            </p>
            <p>
              <span className="text-slate-500">{translate("supplierReceiptTotal")}:</span>{" "}
              {formatRupiah(detail.totalAmount)}
            </p>
            {detail.dueAt && (
              <p>
                <span className="text-slate-500">{translate("supplierReceiptDue")}:</span>{" "}
                {formatDateOnly(detail.dueAt, language)}
              </p>
            )}
            <p>
              <span className="text-slate-500">
                {translate("supplierReceiptPaymentStatus")}:
              </span>{" "}
              {detail.supplierPaymentStatus === "PAID"
                ? translate("supplierReceiptPaid")
                : translate("supplierReceiptUnpaid")}
            </p>
            {detail.note && (
              <p>
                <span className="text-slate-500">{translate("kasirNote")}:</span>{" "}
                {detail.note}
              </p>
            )}
            <p className="text-xs text-slate-400">
              {translate("kasirRecordedBy")}: {detail.recordedByName}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase text-slate-500">
              {translate("supplierReceiptItems")}
            </p>
            {detail.items.length === 0 ? (
              <p className="text-sm text-slate-500">{translate("kasirNoData")}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-2">Produk</th>
                      <th className="px-3 py-2">{translate("kasirQty")}</th>
                      <th className="px-3 py-2">{translate("kasirUnitCost")}</th>
                      <th className="px-3 py-2">{translate("kasirLineTotal")}</th>
                      <th className="px-3 py-2">{translate("kasirExpiryDate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => {
                      const unitCost = isEditing
                        ? Number(costByItem[item.itemId] ?? "0") || 0
                        : item.unitCost;
                      const lineTotal = item.qty * unitCost;

                      return (
                        <tr
                          key={item.itemId}
                          className="border-t border-slate-100 dark:border-slate-800"
                        >
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span>
                                {item.productName}
                                {item.productUnit ? ` (${item.productUnit})` : ""}
                              </span>
                              {item.isEstimated && !isEditing && (
                                <Badge variant="warning">
                                  {translate("supplierReceiptEstimated")}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">{item.qty}</td>
                          <td className="px-3 py-2">
                            {isEditing ? (
                              <InputNumber
                                variant="inline"
                                value={costByItem[item.itemId] ?? ""}
                                onChange={(value) =>
                                  setCostByItem((prev) => ({
                                    ...prev,
                                    [item.itemId]: value,
                                  }))
                                }
                                min={0}
                                format="currency"
                              />
                            ) : (
                              formatRupiah(item.unitCost)
                            )}
                          </td>
                          <td className="px-3 py-2">{formatRupiah(lineTotal)}</td>
                          <td className="px-3 py-2">
                            {item.expiresAt
                              ? formatDateOnly(item.expiresAt, language)
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
