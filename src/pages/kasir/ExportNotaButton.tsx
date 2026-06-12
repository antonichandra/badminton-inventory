import { useState } from "react";
import { useConvex } from "convex/react";
import { FileText } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../../core/components/ui/Button";
import { useLanguage } from "../../core/context/LanguageContext";
import { useToast } from "../../core/context/ToastContext";
import {
  downloadReceiptPdf,
  generateReceiptPdf,
  shareReceiptPdf,
} from "./generateReceiptPdf";

interface ExportNotaButtonProps {
  sessionToken: string;
  batchId: string;
  variant?: "ghost" | "outline";
  size?: "sm" | "md";
}

export function ExportNotaButton({
  sessionToken,
  batchId,
  variant = "ghost",
  size = "sm",
}: ExportNotaButtonProps) {
  const { translate } = useLanguage();
  const { showToast } = useToast();
  const convex = useConvex();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const receipt = await convex.query(api.shifts.getPaymentBatchReceipt, {
        sessionToken,
        batchId,
      });
      if (!receipt.batch || !receipt.business) return;

      const blob = generateReceiptPdf({
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
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: translate("unexpectedError") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      loading={loading}
      leftIcon={<FileText className="h-3.5 w-3.5" />}
    >
      {translate("kasirExportReceipt")}
    </Button>
  );
}
