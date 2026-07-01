import { useState } from "react";
import { useConvex } from "convex/react";
import { FileDown } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../../core/components/ui/Button";
import { useLanguage } from "../../core/context/LanguageContext";
import {
  downloadStockCardPdf,
  generateStockCardPdf,
} from "./generateStockCardPdf";

interface ExportStockCardPdfButtonProps {
  sessionToken: string;
  businessId?: Id<"businesses">;
}

export function ExportStockCardPdfButton({
  sessionToken,
  businessId,
}: ExportStockCardPdfButtonProps) {
  const { translate, language } = useLanguage();
  const convex = useConvex();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const data = await convex.query(api.stockCards.getStockCardExportData, {
        sessionToken,
        businessId,
      });

      const blob = await generateStockCardPdf({
        businessName: data.businessName,
        shiftOpenedAt: data.shiftOpenedAt,
        items: data.items.map((item) => ({
          productName: item.productName,
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          openingQty: item.openingQty,
          unit: item.unit,
        })),
        language,
      });

      const date = new Date().toISOString().slice(0, 10);
      downloadStockCardPdf(blob, `kartu-stok-${date}.pdf`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full shrink-0 sm:w-auto"
      leftIcon={<FileDown className="h-4 w-4" />}
      onClick={handleExport}
      loading={loading}
    >
      {translate("stockCardExportPdf")}
    </Button>
  );
}
