import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AppLanguage } from "../../core/utils/formatDate";
import { formatDateTime } from "../../core/utils/formatDate";
import { groupByCategory } from "../../core/utils/groupByCategory";
import { loadCourtlyLogo } from "../../core/utils/loadCourtlyLogo";

export const STOCK_CARD_PDF_EMPTY_COLUMNS = 6;

export interface StockCardPdfItem {
  productName: string;
  categoryId?: string;
  categoryName: string;
  openingQty: number;
  unit: string;
}

export interface StockCardPdfData {
  businessName: string;
  shiftOpenedAt: number;
  items: StockCardPdfItem[];
  language: AppLanguage;
  emptyColumnCount?: number;
}

const MARGIN = 10;
const LOGO_SIZE = 14;
const CATEGORY_GAP = 7;
const GRID_COLOR: [number, number, number] = [148, 163, 184];

export async function generateStockCardPdf(
  data: StockCardPdfData,
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const tableWidth = pageWidth - MARGIN * 2;
  const emptyCols = data.emptyColumnCount ?? STOCK_CARD_PDF_EMPTY_COLUMNS;
  const productColWidth = 58;
  const openingColWidth = 16;
  const emptyColWidth =
    (tableWidth - productColWidth - openingColWidth) / emptyCols;

  let y = MARGIN;

  try {
    const logo = await loadCourtlyLogo();
    doc.addImage(
      logo,
      "PNG",
      pageWidth - MARGIN - LOGO_SIZE,
      y - 1,
      LOGO_SIZE,
      LOGO_SIZE,
    );
  } catch {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(79, 70, 229);
    doc.text("COURTLY", pageWidth - MARGIN, y + 4, { align: "right" });
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
  }

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(data.businessName, MARGIN, y + 3);
  y += 7;

  doc.setFontSize(10);
  doc.text(
    data.language === "ID" ? "Kartu Stok" : "Stock Card",
    MARGIN,
    y,
  );
  y += 4;

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  const shiftLabel =
    data.language === "ID"
      ? `Shift dibuka: ${formatDateTime(data.shiftOpenedAt, data.language)}`
      : `Shift opened: ${formatDateTime(data.shiftOpenedAt, data.language)}`;
  doc.text(shiftLabel, MARGIN, y);
  doc.setTextColor(0);
  y += 5;

  const groups = groupByCategory(data.items);

  const headRow = [
    data.language === "ID" ? "Produk" : "Product",
    data.language === "ID" ? "Stok awal" : "Opening",
    ...Array.from({ length: emptyCols }, () => ""),
  ];

  const columnStyles: Record<
    number,
    { cellWidth: number; halign?: "center" | "left" | "right" }
  > = {
    0: { cellWidth: productColWidth },
    1: { cellWidth: openingColWidth, halign: "center" },
  };
  for (let i = 0; i < emptyCols; i++) {
    columnStyles[2 + i] = { cellWidth: emptyColWidth, halign: "center" };
  }

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const group = groups[groupIndex];
    if (groupIndex > 0) {
      y += CATEGORY_GAP;
    }

    if (y > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = MARGIN;
    }

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(group.categoryName, MARGIN, y);
    y += 3;

    const body = group.items.map((item) => [
      item.productName,
      String(item.openingQty),
      ...Array.from({ length: emptyCols }, () => ""),
    ]);

    autoTable(doc, {
      startY: y,
      head: [headRow],
      body,
      margin: { left: MARGIN, right: MARGIN },
      tableWidth,
      theme: "grid",
      styles: {
        fontSize: 6,
        cellPadding: { top: 1, right: 1.5, bottom: 1, left: 1.5 },
        minCellHeight: 4.5,
        lineWidth: 0.15,
        lineColor: GRID_COLOR,
        valign: "middle",
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [30, 41, 59],
        fontStyle: "bold",
        fontSize: 6,
        minCellHeight: 9,
        cellPadding: { top: 2, right: 1.5, bottom: 2, left: 1.5 },
        lineWidth: 0.2,
        lineColor: GRID_COLOR,
      },
      columnStyles,
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY;
  }

  return doc.output("blob");
}

export function downloadStockCardPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
