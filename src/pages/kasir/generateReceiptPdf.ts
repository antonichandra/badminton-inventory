import { jsPDF } from "jspdf";
import { formatDateTime } from "../../core/utils/formatDate";
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
const MARGIN_X = 5;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const COLORS = {
  indigo: { r: 79, g: 70, b: 229 },
  indigoLight: { r: 238, g: 242, b: 255 },
  slateMuted: { r: 100, g: 116, b: 139 },
  slateDark: { r: 30, g: 41, b: 59 },
  border: { r: 226, g: 232, b: 240 },
  qris: { r: 124, g: 58, b: 237 },
  cash: { r: 5, g: 150, b: 105 },
  white: { r: 255, g: 255, b: 255 },
};

const LOGO_PATH = "/images/courtly-mark.png";
const LOGO_SIZE = 11;

let logoDataUrlPromise: Promise<string> | null = null;

function loadCourtlyLogo(): Promise<string> {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = fetch(LOGO_PATH)
      .then((response) => {
        if (!response.ok) throw new Error("LOGO_LOAD_FAILED");
        return response.blob();
      })
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("LOGO_READ_FAILED"));
            reader.readAsDataURL(blob);
          }),
      );
  }
  return logoDataUrlPromise;
}

function formatPdfAmount(amount: number): string {
  return formatRupiah(amount).replace("Rp", "").trim();
}

function getLineName(line: ReceiptLine): string {
  const rentalSuffix =
    line.rentalHours && line.rentalHours > 0
      ? ` · ${line.qty}×${line.rentalHours}j`
      : "";
  return line.rentalDescription?.trim() || line.productName + rentalSuffix;
}

function estimatePageHeight(data: ReceiptData): number {
  const addressLines = data.businessAddress
    ? Math.ceil(data.businessAddress.length / 42)
    : 0;
  const headerHeight = 38 + addressLines * 3.2 + (data.sportName ? 4 : 0);
  const itemHeight = data.lines.length * 8;
  const cashExtra =
    data.paymentMethod === "CASH" && data.amountReceived !== undefined ? 10 : 0;
  return Math.max(120, headerHeight + itemHeight + 52 + cashExtra);
}

function setRgb(
  doc: jsPDF,
  color: { r: number; g: number; b: number },
  mode: "draw" | "fill" | "text",
) {
  if (mode === "draw") doc.setDrawColor(color.r, color.g, color.b);
  else if (mode === "fill") doc.setFillColor(color.r, color.g, color.b);
  else doc.setTextColor(color.r, color.g, color.b);
}

function drawAccentLine(doc: jsPDF, y: number) {
  setRgb(doc, COLORS.indigo, "draw");
  doc.setLineWidth(0.4);
  doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
  doc.setLineWidth(0.2);
}

function drawMutedLine(doc: jsPDF, y: number) {
  setRgb(doc, COLORS.border, "draw");
  doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
}

function drawPaymentBadge(
  doc: jsPDF,
  method: ReceiptData["paymentMethod"],
  x: number,
  y: number,
) {
  const label = method === "CASH" ? "CASH" : "QRIS";
  const width = method === "CASH" ? 12 : 11;
  const height = 5;
  const fill = method === "CASH" ? COLORS.cash : COLORS.qris;

  setRgb(doc, fill, "fill");
  doc.roundedRect(x, y, width, height, 1.2, 1.2, "F");
  setRgb(doc, COLORS.white, "text");
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.text(label, x + width / 2, y + 3.4, { align: "center" });
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
}

export async function generateReceiptPdf(data: ReceiptData): Promise<Blob> {
  const pageHeight = estimatePageHeight(data);
  const doc = new jsPDF({ unit: "mm", format: [PAGE_WIDTH, pageHeight] });
  const ref = data.batchId.slice(0, 8).toUpperCase();
  const centerX = PAGE_WIDTH / 2;
  const rightX = PAGE_WIDTH - MARGIN_X;

  let y = 6;

  try {
    const logo = await loadCourtlyLogo();
    doc.addImage(
      logo,
      "PNG",
      centerX - LOGO_SIZE / 2,
      y,
      LOGO_SIZE,
      LOGO_SIZE,
    );
    y += LOGO_SIZE + 3;
  } catch {
    doc.setFontSize(8);
    setRgb(doc, COLORS.indigo, "text");
    doc.setFont("helvetica", "bold");
    doc.text("COURTLY", centerX, y + 3, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    y += 6;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  setRgb(doc, COLORS.slateDark, "text");
  doc.text(data.businessName.toUpperCase(), centerX, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  y += 5;

  doc.setFontSize(7);
  if (data.businessAddress) {
    setRgb(doc, COLORS.slateMuted, "text");
    const addressLines = doc.splitTextToSize(data.businessAddress, CONTENT_WIDTH);
    doc.text(addressLines, centerX, y, { align: "center" });
    y += addressLines.length * 3.2;
  }

  if (data.sportName) {
    setRgb(doc, COLORS.slateMuted, "text");
    doc.text(data.sportName, centerX, y, { align: "center" });
    y += 4;
  }

  setRgb(doc, COLORS.slateMuted, "text");
  doc.text(formatDateTime(data.paidAt, "ID"), centerX, y, { align: "center" });
  y += 3.5;
  doc.setFont("courier", "normal");
  doc.setFontSize(6.5);
  doc.text(`#${ref}`, centerX, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  y += 4;

  drawAccentLine(doc, y);
  y += 4;

  for (const line of data.lines) {
    const name = getLineName(line);
    const nameLines = doc.splitTextToSize(name, CONTENT_WIDTH - 22);
    const blockHeight = nameLines.length * 3.2 + 3.5;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    setRgb(doc, COLORS.slateDark, "text");
    doc.text(nameLines, MARGIN_X, y);
    doc.text(formatPdfAmount(line.lineTotal), rightX, y, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    setRgb(doc, COLORS.slateMuted, "text");
    doc.text(
      `${line.qty} × Rp ${formatPdfAmount(line.unitPrice)}`,
      MARGIN_X,
      y + nameLines.length * 3.2 + 0.5,
    );
    doc.setTextColor(0);
    y += blockHeight + 2;
  }

  drawMutedLine(doc, y);
  y += 4;

  const totalBoxHeight = 10;
  setRgb(doc, COLORS.indigoLight, "fill");
  doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, totalBoxHeight, 2, 2, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  setRgb(doc, COLORS.slateDark, "text");
  doc.text("TOTAL", MARGIN_X + 3, y + 6.2);
  doc.setFontSize(10);
  doc.text(formatRupiah(data.total), rightX - 2, y + 6.5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  y += totalBoxHeight + 4;

  drawPaymentBadge(doc, data.paymentMethod, MARGIN_X, y);
  doc.setFontSize(7);
  setRgb(doc, COLORS.slateMuted, "text");
  doc.text("Metode pembayaran", MARGIN_X + 14, y + 3.5);
  doc.setTextColor(0);
  y += 8;

  if (data.paymentMethod === "CASH" && data.amountReceived !== undefined) {
    doc.setFontSize(7);
    setRgb(doc, COLORS.slateMuted, "text");
    doc.text(`Diterima: ${formatRupiah(data.amountReceived)}`, MARGIN_X, y);
    y += 3.5;
    doc.text(
      `Kembalian: ${formatRupiah(data.changeAmount ?? 0)}`,
      MARGIN_X,
      y,
    );
    doc.setTextColor(0);
    y += 5;
  }

  doc.setFontSize(7);
  setRgb(doc, COLORS.slateMuted, "text");
  doc.text(`Kasir: ${data.recordedByName}`, MARGIN_X, y);
  doc.setTextColor(0);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setRgb(doc, COLORS.slateDark, "text");
  doc.text("Terima kasih", centerX, y, { align: "center" });
  y += 4;

  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  setRgb(doc, COLORS.slateMuted, "text");
  doc.text("Powered by Courtly", centerX, y, { align: "center" });
  doc.setTextColor(0);

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
