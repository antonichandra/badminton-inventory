import { useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { Plus, CreditCard, MoreHorizontal } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PageHeader } from "../core/components/PageHeader";
import { UserInfoRow } from "../core/components/UserInfoRow";
import { PermissionGuard } from "../core/components/PermissionGuard";
import { Button } from "../core/components/ui/Button";
import { useAuth } from "../core/context/AuthContext";
import { useBusiness } from "../core/context/BusinessContext";
import { useLanguage } from "../core/context/LanguageContext";
import { CloseShiftWizard } from "./kasir/CloseShiftWizard";
import { OpenShiftWizard } from "./kasir/OpenShiftWizard";
import {
  PayLinesSheet,
  type PayLinesSheetHandle,
} from "./kasir/PayLinesSheet";
import { PaySuccessSheet } from "./kasir/PaySuccessSheet";
import { QuickActionsMenu } from "./kasir/QuickActionsMenu";
import { RecordSaleSheet } from "./kasir/RecordSaleSheet";
import { SaleFeed } from "./kasir/SaleFeed";
import { ShiftLiveStats } from "./kasir/ShiftLiveStats";
import { ShiftNotOpenBlocked } from "./kasir/ShiftNotOpenBlocked";
import { ShiftReportPanel } from "./kasir/ShiftReportPanel";
import { ShiftSummaryView } from "./kasir/ShiftSummaryView";
import {
  formatRupiah,
  formatShiftOpenedAt,
  getShiftAgeDays,
  type SaleLineView,
} from "./kasir/utils";

type KasirView = "hub" | "open" | "close" | "summary" | "report";

interface PaySuccessState {
  paymentBatchId: string;
  total: number;
  changeAmount: number;
  paymentMethod: "CASH" | "QRIS";
}

export function KasirPage() {
  const { translate, language } = useLanguage();
  const { sessionToken } = useAuth();
  const { activeBusinessId } = useBusiness();

  const [view, setView] = useState<KasirView>("hub");
  const [closedShiftId, setClosedShiftId] = useState<Id<"shifts"> | null>(
    null,
  );
  const [recordOpen, setRecordOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [payMode, setPayMode] = useState(false);
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [canConfirmPay, setCanConfirmPay] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const paySheetRef = useRef<PayLinesSheetHandle>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(
    new Set(),
  );
  const [defaultGroupLabel, setDefaultGroupLabel] = useState("");
  const [paySuccess, setPaySuccess] = useState<PaySuccessState | null>(null);

  const kasirContext = useQuery(
    api.shifts.getKasirContext,
    sessionToken
      ? {
          sessionToken,
          businessId: activeBusinessId ?? undefined,
        }
      : "skip",
  );

  const saleLinesData = useQuery(
    api.shifts.listSaleLines,
    sessionToken && kasirContext?.openShift ? { sessionToken } : "skip",
  );

  const cashPreview = useQuery(
    api.shifts.getShiftCashPreview,
    sessionToken && kasirContext?.openShift ? { sessionToken } : "skip",
  );

  const assigneeData = useQuery(
    api.shifts.listShiftAssignees,
    sessionToken && kasirContext?.activeBusinessId
      ? {
          sessionToken,
          businessId: kasirContext.activeBusinessId,
        }
      : "skip",
  );

  const lines = (saleLinesData?.lines ?? []) as SaleLineView[];
  const openShift = kasirContext?.openShift;
  const canManageShift = kasirContext?.canManageShift ?? false;
  const assignedStaff = kasirContext?.assignedStaff;

  const onDutyStaff = useMemo(() => {
    if (!assignedStaff) return null;
    const assignee = assigneeData?.assignees.find(
      (entry) => entry._id === assignedStaff.id,
    );
    return {
      ...assignedStaff,
      email: assignedStaff.email || assignee?.email,
      roleName: assignedStaff.roleName ?? "STAFF",
    };
  }, [assignedStaff, assigneeData]);

  const selectedPayLines = useMemo(() => {
    return lines.filter(
      (line) =>
        line.paymentStatus === "UNPAID" && selectedLineIds.has(line._id),
    );
  }, [lines, selectedLineIds]);

  const selectedTotal = useMemo(
    () => selectedPayLines.reduce((sum, line) => sum + line.lineTotal, 0),
    [selectedPayLines],
  );

  const handleToggleLine = (lineId: string) => {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  };

  const handlePaySuccess = (result: PaySuccessState) => {
    setPayMode(false);
    setPaySheetOpen(false);
    setSelectedLineIds(new Set());
    setPaySuccess(result);
  };

  if (!sessionToken) {
    return null;
  }

  if (sessionToken && kasirContext === undefined) {
    return (
      <PermissionGuard permission="kasir">
        <PageHeader title={translate("menuKasir")} />
        <p className="text-slate-500">{translate("loading")}</p>
      </PermissionGuard>
    );
  }

  if (kasirContext && !kasirContext.activeBusinessId) {
    return (
      <PermissionGuard permission="kasir">
        <PageHeader title={translate("menuKasir")} />
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-slate-500">{translate("kasirNoBusiness")}</p>
        </div>
      </PermissionGuard>
    );
  }

  if (view === "summary" && closedShiftId) {
    return (
      <PermissionGuard permission="kasir">
        <PageHeader title={translate("menuKasir")} />
        <ShiftSummaryView
          sessionToken={sessionToken}
          shiftId={closedShiftId}
          onOpenNewShift={() => {
            setClosedShiftId(null);
            setView("open");
          }}
        />
      </PermissionGuard>
    );
  }

  if (view === "report") {
    return (
      <PermissionGuard permission="kasir">
        <PageHeader
          title={translate("kasirReportTitle")}
          subtitle={translate("kasirReportSubtitle")}
        />
        <ShiftReportPanel
          sessionToken={sessionToken}
          businessId={kasirContext!.activeBusinessId!}
          onBack={() => setView(openShift ? "hub" : "open")}
        />
      </PermissionGuard>
    );
  }

  if (!openShift) {
    return (
      <PermissionGuard permission="kasir">
        <PageHeader
          title={translate("menuKasir")}
          subtitle={translate("kasirNoOpenShift")}
        />
        {canManageShift ? (
          <OpenShiftWizard
            sessionToken={sessionToken}
            businessId={kasirContext!.activeBusinessId!}
            onComplete={() => setView("hub")}
          />
        ) : (
          <ShiftNotOpenBlocked />
        )}
      </PermissionGuard>
    );
  }

  if (view === "close") {
    return (
      <PermissionGuard permission="kasir">
        <PageHeader title={translate("kasirCloseShiftTitle")} />
        <CloseShiftWizard
          sessionToken={sessionToken}
          onCancel={() => setView("hub")}
          onComplete={(shiftId) => {
            setClosedShiftId(shiftId);
            setView("summary");
          }}
        />
      </PermissionGuard>
    );
  }

  const shiftDays = getShiftAgeDays(openShift.openedAt);
  const estimatedCash = cashPreview?.expectedCash ?? openShift.openingCash;

  return (
    <PermissionGuard permission="kasir">
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-slate-200 bg-white/95 px-4 py-3 pb-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {onDutyStaff ? (
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {translate("kasirOnDuty")}
              </p>
              <UserInfoRow
                name={onDutyStaff.name}
                email={onDutyStaff.email}
                picture={onDutyStaff.picture}
                roleName={onDutyStaff.roleName}
                size="sm"
              />
            </div>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("report")}
            >
              {translate("kasirReport")}
            </Button>
            {canManageShift && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView("close")}
              >
                {translate("kasirCloseShift")}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Shift · {translate("kasirShiftDays").replace("{days}", String(shiftDays))}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {translate("kasirShiftOpenedAt")}:{" "}
            {formatShiftOpenedAt(openShift.openedAt, language)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {translate("kasirOpeningCash")}: {formatRupiah(estimatedCash)}
          </p>
        </div>

        <div className="mt-4">
          <ShiftLiveStats sessionToken={sessionToken} />
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            className="flex-1"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setRecordOpen(true)}
            disabled={payMode}
          >
            {translate("kasirRecord")}
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            leftIcon={<CreditCard className="h-4 w-4" />}
            onClick={() => {
              setPayMode(true);
              setSelectedLineIds(new Set());
            }}
            disabled={payMode}
          >
            {translate("kasirPay")}
          </Button>
          <Button
            variant="outline"
            leftIcon={<MoreHorizontal className="h-4 w-4" />}
            onClick={() => setActionsOpen(true)}
            disabled={payMode}
          >
            {translate("kasirActions")}
          </Button>
        </div>
      </div>

      <SaleFeed
        sessionToken={sessionToken}
        lines={lines}
        payMode={payMode}
        paySheetOpen={paySheetOpen}
        canConfirmPay={canConfirmPay}
        isPaying={isPaying}
        selectedLineIds={selectedLineIds}
        onToggleLine={handleToggleLine}
        onOpenPaySheet={() => setPaySheetOpen(true)}
        onClosePaySheet={() => setPaySheetOpen(false)}
        onConfirmPay={() => paySheetRef.current?.submit()}
        onExitPayMode={() => {
          setPayMode(false);
          setPaySheetOpen(false);
          setSelectedLineIds(new Set());
        }}
        defaultGroupLabel={defaultGroupLabel}
        onSetDefaultGroupLabel={setDefaultGroupLabel}
      />

      <RecordSaleSheet
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        sessionToken={sessionToken}
        businessId={kasirContext!.activeBusinessId!}
        defaultGroupLabel={defaultGroupLabel}
      />

      <QuickActionsMenu
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        sessionToken={sessionToken}
        businessId={kasirContext!.activeBusinessId!}
      />

      <PayLinesSheet
        ref={paySheetRef}
        open={paySheetOpen}
        onClose={() => setPaySheetOpen(false)}
        sessionToken={sessionToken}
        lineIds={selectedPayLines.map((line) => line._id)}
        total={selectedTotal}
        onCanPayChange={setCanConfirmPay}
        onSavingChange={setIsPaying}
        onSuccess={handlePaySuccess}
      />

      {paySuccess && (
        <PaySuccessSheet
          open={!!paySuccess}
          onClose={() => setPaySuccess(null)}
          sessionToken={sessionToken}
          batchId={paySuccess.paymentBatchId}
          total={paySuccess.total}
          changeAmount={paySuccess.changeAmount}
          paymentMethod={paySuccess.paymentMethod}
        />
      )}
    </PermissionGuard>
  );
}
