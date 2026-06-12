import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getSportEmoji } from "../../core/config/sportEmoji";
import { formatRupiah } from "./utils";

export interface ReceiptLine {
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  rentalHours?: number;
  rentalDescription?: string;
}

export interface ReceiptData {
  businessName: string;
  businessAddress?: string;
  sportSlug?: string;
  sportName?: string;
  batchId: string;
  paidAt: number;
  paymentMethod: "CASH" | "QRIS";
  total: number;
  amountReceived?: number;
  changeAmount?: number;
  recordedByName: string;
  lines: ReceiptLine[];
}

const PAGE_WIDTH = 80;
const MARGIN_X = 4;

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPdfAmount(amount: number): string {
  return formatRupiah(amount).replace("Rp", "").trim();
}

function estimatePageHeight(data: ReceiptData): number {
  const headerHeight = data.businessAddress ? 42 : 36;
  const rowHeight = 5;
  const tableHeader = 6;
  const footerHeight =
    data.paymentMethod === "CASH" && data.amountReceived !== undefined ? 38 : 28;
  const rowsHeight = data.lines.length * rowHeight;
  return Math.max(110, headerHeight + tableHeader + rowsHeight + footerHeight + 8);
}

export function generateReceiptPdf(data: ReceiptData): Blob {
  const pageHeight = estimatePageHeight(data);
  const doc = new jsPDF({ unit: "mm", format: [PAGE_WIDTH, pageHeight] });
  const ref = data.batchId.slice(0, 8).toUpperCase();
  const centerX = PAGE_WIDTH / 2;

  let y = 8;

  if (data.sportSlug) {
    doc.setFontSize(14);
    doc.text(getSportEmoji(data.sportSlug), centerX, y, { align: "center" });
    y += 6;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.businessName.toUpperCase(), centerX, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  y += 5;

  doc.setFontSize(7);
  if (data.businessAddress) {
    const addressLines = doc.splitTextToSize(data.businessAddress, PAGE_WIDTH - 8);
    doc.text(addressLines, centerX, y, { align: "center" });
    y += addressLines.length * 3.2;
  }

  if (data.sportName) {
    doc.setTextColor(100);
    doc.text(data.sportName, centerX, y, { align: "center" });
    doc.setTextColor(0);
    y += 4;
  }

  doc.text(formatDateTime(data.paidAt), centerX, y, { align: "center" });
  y += 4;
  doc.text(`Ref: ${ref}`, centerX, y, { align: "center" });
  y += 3;

  doc.setDrawColor(180);
  doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
  y += 2;

  const tableBody = data.lines.map((line) => {
    const name =
      line.rentalDescription?.trim() ||
      line.productName + (line.rentalHours ? ` (${line.rentalHours}j)` : "");
    return [
      name,
      String(line.qty),
      formatPdfAmount(line.unitPrice),
      formatPdfAmount(line.lineTotal),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Item", "Qty", "Harga", "Total"]],
    body: tableBody,
    theme: "plain",
    styles: {
      fontSize: 7,
      cellPadding: 0.8,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fontStyle: "bold",
      fillColor: [245, 245, 245],
      textColor: [30, 30, 30],
    },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 8, halign: "center" },
      2: { cellWidth: 16, halign: "right" },
      3: { cellWidth: 16, halign: "right" },
    },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y + 20;

  let footerY = finalY + 3;
  doc.setDrawColor(180);
  doc.line(MARGIN_X, footerY, PAGE_WIDTH - MARGIN_X, footerY);
  footerY += 4;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(`Total: ${formatRupiah(data.total)}`, PAGE_WIDTH - MARGIN_X, footerY, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  footerY += 4;

  doc.setFontSize(7);
  doc.text(
    `Metode: ${data.paymentMethod === "CASH" ? "Cash" : "QRIS"}`,
    MARGIN_X,
    footerY,
  );

  if (data.paymentMethod === "CASH" && data.amountReceived !== undefined) {
    footerY += 4;
    doc.text(`Diterima: ${formatRupiah(data.amountReceived)}`, MARGIN_X, footerY);
    footerY += 4;
    doc.text(
      `Kembalian: ${formatRupiah(data.changeAmount ?? 0)}`,
      MARGIN_X,
      footerY,
    );
  }

  footerY += 6;
  doc.text(`Kasir: ${data.recordedByName}`, MARGIN_X, footerY);
  footerY += 5;
  doc.setFontSize(8);
  doc.text("Terima kasih", centerX, footerY, { align: "center" });

  return doc.output("blob");
}

export async function shareReceiptPdf(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "application/pdf" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: filename });
    return true;
  }
  return false;
}

export function downloadReceiptPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
