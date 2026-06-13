import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AppLanguage } from "../../core/utils/formatDate";
import { formatDateTime } from "../../core/utils/formatDate";
import { formatRupiah } from "./utils";

interface ShiftExportSummary {
  closedAt: number;
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  cashSales?: number;
  qrisSales?: number;
  expenses?: number;
  deposits?: number;
  variance?: number;
  salesByPriceTier?: Array<{
    productName: string;
    unitPrice: number;
    qty: number;
    revenue: number;
    productType?: "RETAIL" | "RENTAL";
    rentalHoursTotal?: number;
  }>;
}

interface ShiftExportLine {
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  paymentStatus: string;
  paymentMethod?: string;
}

export interface ShiftSummaryPdfData {
  businessName: string;
  shiftId: string;
  openedAt: number;
  closedAt?: number;
  openingCash: number;
  closingCash?: number;
  closingQris?: number;
  summary: ShiftExportSummary | null;
  lines: ShiftExportLine[];
  language: AppLanguage;
}

const MARGIN = 14;

function pdfAmount(amount: number): string {
  return formatRupiah(amount).replace("Rp", "Rp ").trim();
}

export function generateShiftSummaryPdf(data: ShiftSummaryPdfData): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = MARGIN;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.businessName, MARGIN, y);
  y += 7;

  doc.setFontSize(12);
  doc.text(
    data.language === "ID" ? "Ringkasan Shift" : "Shift Summary",
    MARGIN,
    y,
  );
  doc.setFont("helvetica", "normal");
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(`ID: ${data.shiftId.slice(-8).toUpperCase()}`, MARGIN, y);
  y += 5;
  doc.text(
    `${data.language === "ID" ? "Dibuka" : "Opened"}: ${formatDateTime(data.openedAt, data.language)}`,
    MARGIN,
    y,
  );
  y += 4;
  if (data.closedAt) {
    doc.text(
      `${data.language === "ID" ? "Ditutup" : "Closed"}: ${formatDateTime(data.closedAt, data.language)}`,
      MARGIN,
      y,
    );
    y += 4;
  }
  doc.setTextColor(0);
  y += 2;

  const summary = data.summary;
  const summaryRows: string[][] = [
    [
      data.language === "ID" ? "Kas awal" : "Opening cash",
      pdfAmount(data.openingCash),
    ],
    [
      data.language === "ID" ? "Pendapatan" : "Revenue",
      pdfAmount(summary?.totalRevenue ?? 0),
    ],
    [
      data.language === "ID" ? "HPP" : "COGS",
      pdfAmount(summary?.totalCogs ?? 0),
    ],
    [
      data.language === "ID" ? "Untung kotor" : "Gross profit",
      pdfAmount(summary?.grossProfit ?? 0),
    ],
  ];

  if (summary?.cashSales !== undefined) {
    summaryRows.push([
      data.language === "ID" ? "Penjualan cash" : "Cash sales",
      pdfAmount(summary.cashSales),
    ]);
  }
  if (summary?.qrisSales !== undefined) {
    summaryRows.push([
      "QRIS",
      pdfAmount(summary.qrisSales),
    ]);
  }
  if (data.closingCash !== undefined) {
    summaryRows.push([
      data.language === "ID" ? "Kas ditutup" : "Closing cash",
      pdfAmount(data.closingCash),
    ]);
  }
  if (data.closingQris !== undefined) {
    summaryRows.push([
      data.language === "ID" ? "QRIS ditutup" : "Closing QRIS",
      pdfAmount(data.closingQris),
    ]);
  }
  if (summary?.expenses !== undefined) {
    summaryRows.push([
      data.language === "ID" ? "Pengeluaran" : "Expenses",
      pdfAmount(summary.expenses),
    ]);
  }
  if (summary?.variance !== undefined) {
    summaryRows.push([
      data.language === "ID" ? "Selisih" : "Variance",
      pdfAmount(summary.variance),
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [
      [
        data.language === "ID" ? "Keterangan" : "Description",
        data.language === "ID" ? "Nilai" : "Amount",
      ],
    ],
    body: summaryRows,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [71, 85, 105] },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { halign: "right" },
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  y =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y + 20;
  y += 8;

  const tiers = summary?.salesByPriceTier ?? [];
  if (tiers.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(
      data.language === "ID" ? "Penjualan per harga" : "Sales by price",
      MARGIN,
      y,
    );
    doc.setFont("helvetica", "normal");
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [
        [
          data.language === "ID" ? "Produk" : "Product",
          data.language === "ID" ? "Harga" : "Price",
          data.language === "ID" ? "Qty" : "Qty",
          data.language === "ID" ? "Pendapatan" : "Revenue",
        ],
      ],
      body: tiers.map((tier) => {
        const isRental = tier.productType === "RENTAL";
        const qtyLabel = isRental
          ? String(tier.rentalHoursTotal ?? tier.qty)
          : String(tier.qty);
        const priceLabel =
          pdfAmount(tier.unitPrice) + (isRental ? "/jam" : "");
        return [tier.productName, priceLabel, qtyLabel, pdfAmount(tier.revenue)];
      }),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [71, 85, 105] },
      columnStyles: {
        2: { halign: "center" },
        3: { halign: "right" },
      },
      margin: { left: MARGIN, right: MARGIN },
    });

    y =
      (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? y + 20;
    y += 8;
  }

  if (data.lines.length > 0) {
    if (y > 240) {
      doc.addPage();
      y = MARGIN;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(
      data.language === "ID" ? "Detail penjualan" : "Sale lines",
      MARGIN,
      y,
    );
    doc.setFont("helvetica", "normal");
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [
        [
          data.language === "ID" ? "Produk" : "Product",
          "Qty",
          data.language === "ID" ? "Harga" : "Price",
          data.language === "ID" ? "Total" : "Total",
          data.language === "ID" ? "Status" : "Status",
        ],
      ],
      body: data.lines.map((line) => [
        line.productName,
        String(line.qty),
        pdfAmount(line.unitPrice),
        pdfAmount(line.lineTotal),
        line.paymentStatus,
      ]),
      theme: "striped",
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [71, 85, 105] },
      columnStyles: {
        1: { halign: "center" },
        2: { halign: "right" },
        3: { halign: "right" },
      },
      margin: { left: MARGIN, right: MARGIN },
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    formatDateTime(Date.now(), data.language),
    pageWidth - MARGIN,
    doc.internal.pageSize.getHeight() - 8,
    { align: "right" },
  );

  return doc.output("blob");
}

export function downloadShiftSummaryPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
