import type { Id } from "../../../convex/_generated/dataModel";

export function normalizeGroupKey(label: string): string {
  return label.trim().toLowerCase();
}

export function formatGroupLabel(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
}

export function parseGroupLabel(label: string | undefined): string | undefined {
  const trimmed = label?.trim();
  if (!trimmed) return undefined;
  return formatGroupLabel(trimmed);
}

export interface SaleLineView {
  _id: Id<"saleLines">;
  shiftId: Id<"shifts">;
  productId: Id<"products">;
  productName: string;
  productType: "RETAIL" | "RENTAL";
  productUnit: string;
  groupLabel?: string;
  customerNote?: string;
  rentalDescription?: string;
  qty: number;
  rentalHours?: number;
  unitPrice: number;
  lineTotal: number;
  paymentStatus: "UNPAID" | "PAID";
  paymentMethod?: "CASH" | "QRIS";
  paymentBatchId?: string;
  createdAt: number;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDayLabel(
  timestamp: number,
  translate: (key: "kasirToday") => string,
  language: "ID" | "EN",
): string {
  const date = new Date(timestamp);
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isToday) {
    return translate("kasirToday");
  }

  return date.toLocaleDateString(language === "ID" ? "id-ID" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function getShiftAgeDays(openedAt: number): number {
  const diff = Date.now() - openedAt;
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function formatShiftOpenedAt(
  openedAt: number,
  language: "ID" | "EN",
): string {
  return new Date(openedAt).toLocaleString(
    language === "ID" ? "id-ID" : "en-US",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

export interface SaleGroup {
  groupKey: string;
  groupLabel: string;
  lines: SaleLineView[];
}

export interface DayGroup {
  dayKey: string;
  dayLabel: string;
  dayTimestamp: number;
  groups: SaleGroup[];
}

export function groupSaleLinesByDayAndGroup(
  lines: SaleLineView[],
  translate: (key: "kasirToday" | "kasirUngrouped") => string,
  language: "ID" | "EN",
): DayGroup[] {
  const sorted = [...lines].sort((a, b) => b.createdAt - a.createdAt);
  const dayMap = new Map<
    string,
    {
      dayKey: string;
      dayLabel: string;
      dayTimestamp: number;
      groupMap: Map<
        string,
        { displayLabel: string; lines: SaleLineView[]; earliestAt: number }
      >;
    }
  >();

  for (const line of sorted) {
    const dayKey = getDayKey(line.createdAt);
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, {
        dayKey,
        dayLabel: formatDayLabel(line.createdAt, translate, language),
        dayTimestamp: line.createdAt,
        groupMap: new Map(),
      });
    }

    const day = dayMap.get(dayKey)!;
    const rawLabel = line.groupLabel?.trim();
    const groupKey = rawLabel ? normalizeGroupKey(rawLabel) : "__ungrouped__";

    if (!day.groupMap.has(groupKey)) {
      day.groupMap.set(groupKey, {
        displayLabel:
          groupKey === "__ungrouped__"
            ? translate("kasirUngrouped")
            : formatGroupLabel(rawLabel!),
        lines: [],
        earliestAt: line.createdAt,
      });
    }

    const group = day.groupMap.get(groupKey)!;
    group.lines.push(line);
    group.earliestAt = Math.min(group.earliestAt, line.createdAt);
  }

  return Array.from(dayMap.values())
    .sort((a, b) => b.dayTimestamp - a.dayTimestamp)
    .map((day) => ({
      dayKey: day.dayKey,
      dayLabel: day.dayLabel,
      dayTimestamp: day.dayTimestamp,
      groups: Array.from(day.groupMap.entries())
        .sort(([, a], [, b]) => a.earliestAt - b.earliestAt)
        .map(([groupKey, group]) => ({
          groupKey,
          groupLabel: group.displayLabel,
          lines: group.lines.sort((a, b) => b.createdAt - a.createdAt),
        })),
    }));
}

export function formatUnitPriceLabel(
  line: SaleLineView,
  perUnitSuffix: string,
  perHourSuffix: string,
): string {
  const suffix = line.productType === "RENTAL" ? perHourSuffix : perUnitSuffix;
  return `${formatRupiah(line.unitPrice)}${suffix}`;
}

export function formatLineDescription(line: SaleLineView): string {
  if (line.productType === "RENTAL") {
    const hours = line.rentalHours ?? 0;
    const desc = line.rentalDescription?.trim();
    return desc
      ? `${line.productName} · ${hours} jam · ${desc}`
      : `${line.productName} · ${hours} jam`;
  }

  return `${line.productName} ×${line.qty}`;
}
