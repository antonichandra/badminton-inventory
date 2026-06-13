import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { ChevronDown, MoreVertical, Minus, Plus, Trash2, Undo2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "../../core/components/table/Badge";
import { Button } from "../../core/components/ui/Button";
import { ConfirmModal } from "../../core/components/ui/ConfirmModal";
import { useLanguage } from "../../core/context/LanguageContext";
import { useToast } from "../../core/context/ToastContext";
import { useNavigationLayout } from "../../core/hooks/useNavigationLayout";
import { ExportNotaButton } from "./ExportNotaButton";
import {
  formatLineDescription,
  formatRupiah,
  formatUnitPriceLabel,
  groupSaleLinesByDayAndGroup,
  parseGroupLabel,
  type SaleLineView,
} from "./utils";

interface SaleFeedProps {
  sessionToken: string;
  lines: SaleLineView[];
  payMode: boolean;
  paySheetOpen: boolean;
  canConfirmPay: boolean;
  isPaying: boolean;
  selectedLineIds: Set<string>;
  onToggleLine: (lineId: string) => void;
  onOpenPaySheet: () => void;
  onClosePaySheet: () => void;
  onConfirmPay: () => void;
  onExitPayMode: () => void;
  defaultGroupLabel: string;
  onSetDefaultGroupLabel: (label: string) => void;
}

function collapseKey(dayKey: string, groupKey: string) {
  return `${dayKey}::${groupKey}`;
}

export function SaleFeed({
  sessionToken,
  lines,
  payMode,
  paySheetOpen,
  canConfirmPay,
  isPaying,
  selectedLineIds,
  onToggleLine,
  onOpenPaySheet,
  onClosePaySheet,
  onConfirmPay,
  onExitPayMode,
  defaultGroupLabel,
  onSetDefaultGroupLabel,
}: SaleFeedProps) {
  const { translate, language } = useLanguage();
  const { showToast } = useToast();
  const useBottomNav = useNavigationLayout() === "bottom";

  const updateSaleLine = useMutation(api.shifts.updateSaleLine);
  const deleteSaleLine = useMutation(api.shifts.deleteSaleLine);
  const voidSaleLinePayment = useMutation(api.shifts.voidSaleLinePayment);

  const [menuLineId, setMenuLineId] = useState<string | null>(null);
  const [deleteLineId, setDeleteLineId] = useState<Id<"saleLines"> | null>(
    null,
  );
  const [isActing, setIsActing] = useState(false);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [newGroupInput, setNewGroupInput] = useState("");

  const dayGroups = useMemo(
    () => groupSaleLinesByDayAndGroup(lines, translate, language),
    [lines, translate, language],
  );

  const selectedLines = useMemo(
    () =>
      lines.filter(
        (line) =>
          line.paymentStatus === "UNPAID" && selectedLineIds.has(line._id),
      ),
    [lines, selectedLineIds],
  );

  const selectedTotal = useMemo(
    () => selectedLines.reduce((sum, line) => sum + line.lineTotal, 0),
    [selectedLines],
  );

  const handleQtyChange = async (line: SaleLineView, delta: number) => {
    const nextQty = line.qty + delta;
    if (nextQty <= 0) return;

    try {
      await updateSaleLine({
        sessionToken,
        lineId: line._id,
        qty: nextQty,
      });
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: translate("unexpectedError") });
    }
  };

  const handleDelete = async () => {
    if (!deleteLineId) return;
    setIsActing(true);
    try {
      await deleteSaleLine({ sessionToken, lineId: deleteLineId });
      showToast({
        type: "success",
        message: translate("kasirDeleteSuccess"),
      });
      setDeleteLineId(null);
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: translate("unexpectedError") });
    } finally {
      setIsActing(false);
    }
  };

  const handleVoidPayment = async (lineId: Id<"saleLines">) => {
    try {
      await voidSaleLinePayment({ sessionToken, lineId });
      showToast({
        type: "success",
        message: translate("kasirVoidSuccess"),
      });
      setMenuLineId(null);
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: translate("unexpectedError") });
    }
  };

  const toggleDay = (dayKey: string) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayKey)) {
        next.delete(dayKey);
      } else {
        next.add(dayKey);
      }
      return next;
    });
  };

  const toggleGroup = (dayKey: string, groupKey: string) => {
    const key = collapseKey(dayKey, groupKey);
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const applyNewGroup = () => {
    const label = parseGroupLabel(newGroupInput);
    if (!label) return;
    onSetDefaultGroupLabel(label);
    setNewGroupInput("");
  };

  const renderLine = (line: SaleLineView) => {
    const isUnpaid = line.paymentStatus === "UNPAID";
    const isSelected = selectedLineIds.has(line._id);
    const showMenu = menuLineId === line._id;
    const unitPriceLabel = formatUnitPriceLabel(
      line,
      translate("kasirPerPcs"),
      translate("kasirPerHour"),
    );

    return (
      <div
        key={line._id}
        className={`flex items-start gap-2.5 border-t border-slate-100 px-3 py-2.5 first:border-t-0 dark:border-slate-800 ${
          payMode && isSelected
            ? "bg-emerald-50/60 dark:bg-emerald-950/20"
            : "hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
        }`}
      >
        {payMode && isUnpaid && (
          <label className="mt-0.5 flex shrink-0 cursor-pointer items-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleLine(line._id)}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-emerald-600 focus:ring-emerald-500"
            />
          </label>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {formatLineDescription(line)}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge
                  variant={isUnpaid ? "warning" : "success"}
                  className="px-1.5 py-0 text-[10px]"
                >
                  {isUnpaid
                    ? translate("kasirUnpaid")
                    : `${translate("kasirPaid")} ${
                        line.paymentMethod === "QRIS"
                          ? translate("kasirQris")
                          : translate("kasirCash")
                      }`}
                </Badge>
                {isUnpaid && !payMode && (
                  <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1 py-0.5 dark:border-slate-700 dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => handleQtyChange(line, -1)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Minus className="h-2.5 w-2.5" />
                    </button>
                    <span className="min-w-[1.25rem] text-center text-xs font-medium text-slate-700 dark:text-slate-200">
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQtyChange(line, 1)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )}
              </div>
              {line.customerNote && (
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  {line.customerNote}
                </p>
              )}
            </div>

            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {formatRupiah(line.lineTotal)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {unitPriceLabel}
              </p>
            </div>
          </div>
        </div>

        {!payMode && (
          <div className="relative shrink-0 self-center">
            <button
              type="button"
              onClick={() => setMenuLineId(showMenu ? null : line._id)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {isUnpaid ? (
                  <button
                    type="button"
                    onClick={() => setDeleteLineId(line._id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {translate("kasirDeleteLine")}
                  </button>
                ) : (
                  <>
                    {line.paymentBatchId && (
                      <div className="px-2 py-1">
                        <ExportNotaButton
                          sessionToken={sessionToken}
                          batchId={line.paymentBatchId}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleVoidPayment(line._id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      {translate("kasirVoidPayment")}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={
        payMode
          ? useBottomNav
            ? "space-y-3 pb-[calc(5.5rem+var(--bottom-nav-total))]"
            : "space-y-3 pb-32"
          : "space-y-3"
      }
    >
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
        <input
          type="text"
          value={newGroupInput}
          onChange={(event) => setNewGroupInput(event.target.value)}
          placeholder={translate("kasirNewGroup")}
          className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <Button variant="outline" size="sm" onClick={applyNewGroup}>
          {translate("kasirNewGroup")}
        </Button>
        {defaultGroupLabel && (
          <span className="text-xs text-slate-500">
            {translate("kasirGroup")}: {defaultGroupLabel}
          </span>
        )}
      </div>

      {dayGroups.map((day) => {
        const dayCollapsed = collapsedDays.has(day.dayKey);
        return (
          <section
            key={day.dayKey}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
          >
            <button
              type="button"
              onClick={() => toggleDay(day.dayKey)}
              className="flex w-full items-center justify-between px-2.5 py-2 text-left"
            >
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {day.dayLabel}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform ${
                  dayCollapsed ? "-rotate-90" : ""
                }`}
              />
            </button>

            {!dayCollapsed && (
              <div className="border-t border-slate-100 dark:border-slate-800">
                {day.groups.map((group) => {
                  const groupCollapsed = collapsedGroups.has(
                    collapseKey(day.dayKey, group.groupKey),
                  );
                  const showGroupHeader =
                    group.groupKey !== "__ungrouped__" ||
                    day.groups.length > 1;

                  if (!showGroupHeader) {
                    return (
                      <div key={group.groupKey}>
                        {group.lines.map(renderLine)}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={group.groupKey}
                      className="border-t border-slate-100 first:border-t-0 dark:border-slate-800"
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroup(day.dayKey, group.groupKey)}
                        className="flex w-full items-center justify-between bg-slate-50/80 px-2.5 py-1.5 text-left dark:bg-slate-800/40"
                      >
                        <span className="text-[11px] font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">
                          {group.groupLabel}
                          <span className="ml-2 font-normal text-slate-400 normal-case">
                            ({group.lines.length})
                          </span>
                        </span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                            groupCollapsed ? "-rotate-90" : ""
                          }`}
                        />
                      </button>
                      {!groupCollapsed && group.lines.map(renderLine)}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {payMode && (
        <div
          className={`fixed inset-x-0 z-[70] border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_24px_-8px_rgba(15,23,42,0.15)] dark:border-slate-700 dark:bg-slate-900 ${
            useBottomNav
              ? "bottom-[var(--bottom-nav-total)]"
              : "bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          }`}
        >
          <div className="mx-auto flex max-w-7xl items-end justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {translate("kasirPayTotal")}
              </p>
              <p className="mt-0.5 text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
                {formatRupiah(selectedTotal)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {translate("kasirPaySelectedCount").replace(
                  "{count}",
                  String(selectedLines.length),
                )}
              </p>
            </div>
            <div className="flex shrink-0 gap-2 pb-0.5">
              <Button
                variant="ghost"
                onClick={() => {
                  if (paySheetOpen) {
                    onClosePaySheet();
                  } else {
                    onExitPayMode();
                  }
                }}
                disabled={isPaying}
              >
                {translate("cancel")}
              </Button>
              <Button
                onClick={paySheetOpen ? onConfirmPay : onOpenPaySheet}
                loading={isPaying}
                disabled={
                  selectedLineIds.size === 0 ||
                  (paySheetOpen && !canConfirmPay)
                }
              >
                {translate("kasirPay")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteLineId}
        onClose={() => setDeleteLineId(null)}
        title={translate("kasirDeleteLine")}
        confirmLabel={translate("kasirDeleteLine")}
        cancelLabel={translate("cancel")}
        confirmVariant="danger"
        loading={isActing}
        onConfirm={handleDelete}
      />
    </div>
  );
}
