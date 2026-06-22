interface ExportLine {
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  paymentStatus: string;
  paymentMethod?: string;
  cogsTotal?: number;
  paidAt?: number;
}

interface ExportSummary {
  totalRevenue: number;
  totalCogs?: number;
  grossProfit?: number;
  closedAt: number;
}

export function exportShiftToCsv(
  shiftId: string,
  summary: ExportSummary | null,
  lines: ExportLine[],
  includeProfit = true,
) {
  const rows: string[][] = [
    ["Shift ID", shiftId],
    [
      "Closed At",
      summary
        ? new Date(summary.closedAt).toISOString()
        : new Date().toISOString(),
    ],
    ["Total Revenue", String(summary?.totalRevenue ?? 0)],
  ];

  if (includeProfit) {
    rows.push(
      ["Total COGS", String(summary?.totalCogs ?? 0)],
      ["Gross Profit", String(summary?.grossProfit ?? 0)],
    );
  }

  rows.push(
    [],
    includeProfit
      ? [
          "Product",
          "Qty",
          "Unit Price",
          "Total",
          "Status",
          "Method",
          "COGS",
          "Paid At",
        ]
      : ["Product", "Qty", "Unit Price", "Total", "Status", "Method", "Paid At"],
  );

  for (const line of lines) {
    rows.push(
      includeProfit
        ? [
            line.productName,
            String(line.qty),
            String(line.unitPrice),
            String(line.lineTotal),
            line.paymentStatus,
            line.paymentMethod ?? "",
            String(line.cogsTotal ?? ""),
            line.paidAt ? new Date(line.paidAt).toISOString() : "",
          ]
        : [
            line.productName,
            String(line.qty),
            String(line.unitPrice),
            String(line.lineTotal),
            line.paymentStatus,
            line.paymentMethod ?? "",
            line.paidAt ? new Date(line.paidAt).toISOString() : "",
          ],
    );
  }

  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shift-${shiftId.slice(-8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
