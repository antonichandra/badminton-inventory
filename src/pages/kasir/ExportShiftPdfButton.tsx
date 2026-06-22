import { useState } from "react";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../../core/components/ui/Button";
import { useLanguage } from "../../core/context/LanguageContext";
import {
  downloadShiftSummaryPdf,
  generateShiftSummaryPdf,
} from "./generateShiftSummaryPdf";

interface ExportShiftPdfButtonProps {
  sessionToken: string;
  shiftId: Id<"shifts">;
}

export function ExportShiftPdfButton({
  sessionToken,
  shiftId,
}: ExportShiftPdfButtonProps) {
  const { translate, language } = useLanguage();
  const convex = useConvex();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const data = await convex.query(api.shifts.getShiftExportData, {
        sessionToken,
        shiftId,
      });

      const blob = generateShiftSummaryPdf({
        businessName: data.businessName,
        shiftId: shiftId as string,
        openedAt: data.shift.openedAt,
        closedAt: data.shift.closedAt,
        openingCash: data.shift.openingCash,
        closingCash: data.shift.closingCash,
        closingQris: data.shift.closingQris,
        summary: data.summary,
        lines: data.lines,
        language,
        includeProfit: data.includeProfit,
      });

      downloadShiftSummaryPdf(blob, `shift-${shiftId.slice(-8)}.pdf`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} loading={loading}>
      {translate("kasirExportPdf")}
    </Button>
  );
}
