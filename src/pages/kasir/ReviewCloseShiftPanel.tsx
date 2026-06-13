import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { InputNumber } from "../../core/components/forms/InputNumber";
import { Button } from "../../core/components/ui/Button";
import { useLanguage } from "../../core/context/LanguageContext";
import { useToast } from "../../core/context/ToastContext";
import { formatRupiah } from "./utils";

interface ReviewCloseShiftPanelProps {
  sessionToken: string;
  businessId: Id<"businesses">;
  onComplete: (shiftId: Id<"shifts">) => void;
  onCancel: () => void;
}

export function ReviewCloseShiftPanel({
  sessionToken,
  businessId,
  onComplete,
  onCancel,
}: ReviewCloseShiftPanelProps) {
  const { translate } = useLanguage();
  const { showToast } = useToast();
  const approveClose = useMutation(api.shifts.approveShiftCloseRequest);
  const rejectClose = useMutation(api.shifts.rejectShiftCloseRequest);

  const pending = useQuery(api.shifts.listPendingCloseRequests, {
    sessionToken,
    businessId,
  });

  const [selectedId, setSelectedId] = useState<Id<"shiftCloseRequests"> | null>(
    null,
  );
  const [verifiedQris, setVerifiedQris] = useState("0");
  const [isSaving, setIsSaving] = useState(false);

  const selected = useMemo(
    () => pending?.find((request) => request._id === selectedId) ?? pending?.[0],
    [pending, selectedId],
  );

  const preview = useQuery(
    api.shifts.getShiftClosePreview,
    selected
      ? {
          sessionToken,
          reportedCash: selected.reportedCash,
          verifiedQris: Number(verifiedQris) || 0,
          closingStock: selected.closingStock,
        }
      : "skip",
  );

  const handleApprove = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      const result = await approveClose({
        sessionToken,
        requestId: selected._id,
        verifiedQris: Number(verifiedQris) || 0,
      });
      showToast({
        type: "success",
        message: translate("kasirShiftClosed"),
      });
      onComplete(result.shiftId);
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: translate("unexpectedError") });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      await rejectClose({
        sessionToken,
        requestId: selected._id,
      });
      showToast({
        type: "success",
        message: translate("kasirCloseRequestRejected"),
      });
      onCancel();
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: translate("unexpectedError") });
    } finally {
      setIsSaving(false);
    }
  };

  if (pending === undefined) {
    return <p className="text-slate-500">{translate("loading")}</p>;
  }

  if (pending.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
        <p className="text-slate-500">{translate("kasirNoPendingClose")}</p>
        <Button className="mt-4" variant="ghost" onClick={onCancel}>
          {translate("cancel")}
        </Button>
      </div>
    );
  }

  const cash = preview?.cashSummary;
  const variance = cash?.totalVariance ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {pending.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {pending.map((request) => (
            <Button
              key={request._id}
              size="sm"
              variant={selected?._id === request._id ? "primary" : "outline"}
              onClick={() => setSelectedId(request._id)}
            >
              {request.submitterName}
            </Button>
          ))}
        </div>
      )}

      {selected && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {translate("kasirReviewCloseTitle")}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {translate("kasirReviewCloseBy")}: {selected.submitterName}
          </p>

          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              {translate("kasirSalesGapTitle")}
            </p>
            <p className="mt-1 text-amber-800 dark:text-amber-300">
              {translate("kasirOverInput")}: {preview?.overInputQtyTotal ?? 0}{" "}
              · {translate("kasirMissInput")}: {preview?.missInputQtyTotal ?? 0}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
              <p className="text-slate-500">{translate("kasirClosingCash")}</p>
              <p className="font-semibold">
                {formatRupiah(selected.reportedCash)}
              </p>
            </div>
            <InputNumber
              label={translate("kasirVerifiedQris")}
              value={verifiedQris}
              onChange={setVerifiedQris}
              min={0}
              required
            />
          </div>

          {cash && (
            <div className="mt-4 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-700">
              <p>
                {translate("kasirTotalSales")}: {formatRupiah(cash.totalSales)}
              </p>
              <p>
                {translate("kasirExpectedCashDrawer")}:{" "}
                {formatRupiah(cash.expectedCashInDrawer)}
              </p>
              <p>
                {translate("kasirActual")}: {formatRupiah(cash.totalActual)}
              </p>
              <p
                className={
                  variance < 0
                    ? "mt-2 font-semibold text-red-600"
                    : variance > 0
                      ? "mt-2 font-semibold text-emerald-600"
                      : "mt-2 font-semibold text-slate-700 dark:text-slate-200"
                }
              >
                {translate("kasirVariance")}: {formatRupiah(variance)}
                {variance < 0 && ` (${translate("kasirStaffMinus")})`}
                {variance > 0 && ` (${translate("kasirStaffPlus")})`}
                {variance === 0 && ` (${translate("kasirStaffExact")})`}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={onCancel}>
              {translate("cancel")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReject} loading={isSaving}>
                {translate("kasirRejectClose")}
              </Button>
              <Button variant="danger" onClick={handleApprove} loading={isSaving}>
                {translate("kasirApproveClose")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
