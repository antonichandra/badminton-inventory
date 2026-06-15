import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BottomSheet } from "../../core/components/ui/BottomSheet";
import { Button } from "../../core/components/ui/Button";
import { useLanguage } from "../../core/context/LanguageContext";
import { useToast } from "../../core/context/ToastContext";
import {
  downloadReceiptPdf,
  generateReceiptPdf,
  shareReceiptPdf,
} from "./generateReceiptPdf";
import { formatRupiah } from "./utils";

interface PaySuccessSheetProps {
  open: boolean;
  onClose: () => void;
  sessionToken: string;
  batchId: string;
  total: number;
  changeAmount: number;
  paymentMethod: "CASH" | "QRIS";
}

export function PaySuccessSheet({
  open,
  onClose,
  sessionToken,
  batchId,
  total,
  changeAmount,
  paymentMethod,
}: PaySuccessSheetProps) {
  const { translate } = useLanguage();
  const { showToast } = useToast();

  const receipt = useQuery(
    api.shifts.getPaymentBatchReceipt,
    open && batchId ? { sessionToken, batchId } : "skip",
  );

  const handleExport = async () => {
    if (!receipt?.batch || !receipt.business) return;

    const blob = await generateReceiptPdf({
      businessName: receipt.business.name,
      businessAddress: receipt.business.address,
      sportSlug: receipt.sport?.slug,
      sportName: receipt.sport?.name,
      batchId: receipt.batch.batchId,
      paidAt: receipt.batch.paidAt,
      paymentMethod: receipt.batch.paymentMethod,
      total: receipt.batch.total,
      amountReceived: receipt.batch.amountReceived,
      changeAmount: receipt.batch.changeAmount,
      recordedByName: receipt.recordedByName,
      lines: receipt.lines,
    });

    const filename = `nota-${receipt.batch.batchId.slice(0, 8)}.pdf`;
    const shared = await shareReceiptPdf(blob, filename);
    if (!shared) {
      downloadReceiptPdf(blob, filename);
      showToast({
        type: "success",
        message: translate("kasirReceiptDownloaded"),
      });
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={translate("kasirPaySuccess")}
      footer={
        <div className="flex flex-col gap-2">
          <Button onClick={handleExport} disabled={!receipt}>
            {translate("kasirExportReceipt")}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {translate("kasirCloseReceipt")}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">{translate("kasirPayTotal")}</span>
          <span className="font-semibold">{formatRupiah(total)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">{translate("kasirSelectPayment")}</span>
          <span>
            {paymentMethod === "CASH"
              ? translate("kasirCash")
              : translate("kasirQris")}
          </span>
        </div>
        {paymentMethod === "CASH" && (
          <div className="flex justify-between">
            <span className="text-slate-500">{translate("kasirChange")}</span>
            <span className="font-semibold text-emerald-600">
              {formatRupiah(changeAmount)}
            </span>
          </div>
        )}
        <p className="text-xs text-slate-500">{translate("kasirReceiptHint")}</p>
      </div>
    </BottomSheet>
  );
}
