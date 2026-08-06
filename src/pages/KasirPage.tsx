import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Plus, CreditCard, MoreHorizontal } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PageHeader } from "../core/components/PageHeader";
import { UserInfoRow } from "../core/components/UserInfoRow";
import { PermissionGuard } from "../core/components/PermissionGuard";
import { Button } from "../core/components/ui/Button";
import { IconButton } from "../core/components/ui/IconButton";
import { LoadingState } from "../core/components/ui/LoadingState";
import { ViewPanelTransition } from "../core/components/ui/ViewPanelTransition";
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
import { ReviewCloseShiftPanel } from "./kasir/ReviewCloseShiftPanel";
import { SubmitCloseShiftWizard } from "./kasir/SubmitCloseShiftWizard";
import {
  formatRupiah,
  formatShiftOpenedAt,
  getShiftAgeDays,
  type SaleLineView,
} from "./kasir/utils";

type KasirView =
  | "hub"
  | "open"
  | "close"
  | "submit-close"
  | "review-close"
  | "summary"
  | "report";

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
  const [summaryReturnView, setSummaryReturnView] = useState<KasirView>("hub");
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
  const prevBusinessIdRef = useRef(activeBusinessId);

  useEffect(() => {
    if (prevBusinessIdRef.current === activeBusinessId) return;
    prevBusinessIdRef.current = activeBusinessId;
    setView("hub");
    setClosedShiftId(null);
    setRecordOpen(false);
    setActionsOpen(false);
    setPayMode(false);
    setPaySheetOpen(false);
    setSelectedLineIds(new Set());
    setPaySuccess(null);
  }, [activeBusinessId]);

  const kasirContext = useQuery(
    api.shifts.getKasirContext,
    sessionToken
      ? {
          sessionToken,
          businessId: activeBusinessId ?? undefined,
        }
      : "skip",
  );

  const openShift =
    kasirContext?.openShift &&
    kasirContext.activeBusinessId &&
    kasirContext.openShift.businessId === kasirContext.activeBusinessId
      ? kasirContext.openShift
      : null;

  const syncOpenShiftOpeningStock = useMutation(
    api.shifts.syncOpenShiftOpeningStock,
  );
  const openingSyncStarted = useRef(false);

  useEffect(() => {
    if (!sessionToken || !activeBusinessId) return;
    const key = `opening-stock-synced-business:${activeBusinessId}`;
    if (!openShift) {
      sessionStorage.removeItem(key);
      openingSyncStarted.current = false;
      return;
    }
    if (sessionStorage.getItem(key) === "1" || openingSyncStarted.current) {
      return;
    }
    openingSyncStarted.current = true;
    void syncOpenShiftOpeningStock({ sessionToken })
      .then(() => {
        sessionStorage.setItem(key, "1");
      })
      .catch((error) => {
        openingSyncStarted.current = false;
        console.error(error);
      });
  }, [sessionToken, activeBusinessId, openShift, syncOpenShiftOpeningStock]);

  const saleLinesData = useQuery(
    api.shifts.listSaleLines,
    sessionToken && openShift ? { sessionToken } : "skip",
  );

  const cashPreview = useQuery(
    api.shifts.getShiftCashPreview,
    sessionToken && openShift ? { sessionToken } : "skip",
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
  const canManageShift = kasirContext?.canManageShift ?? false;
  const shiftIsPending = kasirContext?.shiftStatus === "CLOSE_PENDING";
  const pendingCloseCount = kasirContext?.pendingCloseCount ?? 0;
  const transactionsLocked = payMode || shiftIsPending;
  const assignedStaff = kasirContext?.assignedStaff;
  const activeBusiness = kasirContext?.activeBusinessId ?? null;

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

  const panel = useMemo(() => {
    if (!sessionToken) {
      return { panelKey: "unauthenticated", content: null };
    }

    if (kasirContext === undefined) {
      return {
        panelKey: "loading",
        content: (
          <>
            <PageHeader title={translate("menuKasir")} />
            <LoadingState variant="page" />
          </>
        ),
      };
    }

    if (!activeBusiness) {
      return {
        panelKey: "no-business",
        content: (
          <>
            <PageHeader title={translate("menuKasir")} />
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="text-slate-500">{translate("kasirNoBusiness")}</p>
            </div>
          </>
        ),
      };
    }

    if (view === "summary" && closedShiftId) {
      return {
        panelKey: `summary-${closedShiftId}`,
        content: (
          <>
            <div className="mb-5 flex items-start gap-2 sm:mb-8 sm:gap-3">
              <IconButton
                icon={<ArrowLeft className="h-5 w-5" />}
                tooltip={translate("kasirBack")}
                variant="ghost"
                className="mt-0.5 shrink-0"
                aria-label={translate("kasirBack")}
                onClick={() => {
                  setClosedShiftId(null);
                  setView(
                    summaryReturnView === "report" || !openShift ? "report" : "hub",
                  );
                }}
              />
              <div className="min-w-0 flex-1">
                <PageHeader embedded title={translate("kasirSummary")} />
              </div>
            </div>
            <ShiftSummaryView
              sessionToken={sessionToken}
              shiftId={closedShiftId}
              showOpenNewShift={summaryReturnView !== "report"}
              onOpenNewShift={() => {
                setClosedShiftId(null);
                setView("open");
              }}
            />
          </>
        ),
      };
    }

    if (view === "report") {
      return {
        panelKey: "report",
        content: (
          <>
            <div className="mb-5 flex items-start gap-2 sm:mb-8 sm:gap-3">
              <IconButton
                icon={<ArrowLeft className="h-5 w-5" />}
                tooltip={translate("kasirBack")}
                variant="ghost"
                className="mt-0.5 shrink-0"
                aria-label={translate("kasirBack")}
                onClick={() => setView("hub")}
              />
              <div className="min-w-0 flex-1">
                <PageHeader
                  embedded
                  title={translate("kasirReportTitle")}
                  subtitle={translate("kasirReportSubtitle")}
                />
              </div>
            </div>
            <ShiftReportPanel
              sessionToken={sessionToken}
              businessId={activeBusiness}
              onViewShift={(shiftId) => {
                setClosedShiftId(shiftId);
                setSummaryReturnView("report");
                setView("summary");
              }}
            />
          </>
        ),
      };
    }

    if (!openShift) {
      return {
        panelKey: canManageShift ? "open-shift" : "shift-blocked",
        content: (
          <>
            <PageHeader
              title={translate("menuKasir")}
              subtitle={translate("kasirNoOpenShift")}
            />
            <div className="mb-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSummaryReturnView("report");
                  setView("report");
                }}
              >
                {translate("kasirViewShiftHistory")}
              </Button>
            </div>
            {canManageShift ? (
              <OpenShiftWizard
                sessionToken={sessionToken}
                businessId={activeBusiness}
                onComplete={() => setView("hub")}
              />
            ) : (
              <ShiftNotOpenBlocked
                onViewHistory={() => {
                  setSummaryReturnView("report");
                  setView("report");
                }}
              />
            )}
          </>
        ),
      };
    }

    if (view === "submit-close") {
      return {
        panelKey: "submit-close",
        content: (
          <>
            <PageHeader title={translate("kasirSubmitCloseTitle")} />
            <SubmitCloseShiftWizard
              sessionToken={sessionToken}
              onCancel={() => setView("hub")}
              onComplete={() => setView("hub")}
            />
          </>
        ),
      };
    }

    if (view === "review-close") {
      return {
        panelKey: "review-close",
        content: (
          <>
            <PageHeader title={translate("kasirReviewCloseTitle")} />
            <ReviewCloseShiftPanel
              sessionToken={sessionToken}
              businessId={activeBusiness}
              onCancel={() => setView("hub")}
              onComplete={(shiftId) => {
                setClosedShiftId(shiftId);
                setSummaryReturnView("report");
                setView("summary");
              }}
            />
          </>
        ),
      };
    }

    if (view === "close") {
      return {
        panelKey: "close-shift",
        content: (
          <>
            <PageHeader title={translate("kasirCloseShiftTitle")} />
            <CloseShiftWizard
              sessionToken={sessionToken}
              onCancel={() => setView("hub")}
              onComplete={(shiftId) => {
                setClosedShiftId(shiftId);
                setSummaryReturnView("report");
                setView("summary");
              }}
            />
          </>
        ),
      };
    }

    const shiftDays = getShiftAgeDays(openShift.openedAt);
    const estimatedCash = cashPreview?.expectedCash ?? openShift.openingCash;

    return {
      panelKey: "hub",
      content: (
        <>
          <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-slate-200 bg-white/95 px-4 py-3 pb-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:-mx-6 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              {onDutyStaff ? (
                <div className="min-w-0 flex-1">
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
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView("report")}
                >
                  {translate("kasirReport")}
                </Button>
                {canManageShift && pendingCloseCount > 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setView("review-close")}
                  >
                    {translate("kasirReviewClose")} ({pendingCloseCount})
                  </Button>
                )}
                {canManageShift && !shiftIsPending && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setView("close")}
                  >
                    {translate("kasirCloseShift")}
                  </Button>
                )}
                {!canManageShift && !shiftIsPending && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setView("submit-close")}
                  >
                    {translate("kasirSubmitClose")}
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Shift ·{" "}
                {translate("kasirShiftDays").replace("{days}", String(shiftDays))}
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

            {shiftIsPending && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                {translate("kasirClosePendingBanner")}
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <Button
                className="flex-1"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setRecordOpen(true)}
                disabled={transactionsLocked}
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
                disabled={transactionsLocked}
              >
                {translate("kasirPay")}
              </Button>
              <Button
                variant="outline"
                leftIcon={<MoreHorizontal className="h-4 w-4" />}
                onClick={() => setActionsOpen(true)}
                disabled={transactionsLocked}
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
        </>
      ),
    };
  }, [
    sessionToken,
    kasirContext,
    activeBusiness,
    view,
    closedShiftId,
    summaryReturnView,
    openShift,
    canManageShift,
    translate,
    onDutyStaff,
    pendingCloseCount,
    shiftIsPending,
    cashPreview,
    language,
    lines,
    payMode,
    paySheetOpen,
    canConfirmPay,
    isPaying,
    selectedLineIds,
    transactionsLocked,
    defaultGroupLabel,
  ]);

  if (!sessionToken) {
    return null;
  }

  const showHubOverlays = panel.panelKey === "hub" && openShift && activeBusiness;

  return (
    <PermissionGuard permission="kasir">
      <ViewPanelTransition panelKey={panel.panelKey}>
        {panel.content}
      </ViewPanelTransition>

      {showHubOverlays && (
        <>
          <RecordSaleSheet
            open={recordOpen}
            onClose={() => setRecordOpen(false)}
            sessionToken={sessionToken}
            businessId={activeBusiness}
            defaultGroupLabel={defaultGroupLabel}
          />

          <QuickActionsMenu
            open={actionsOpen}
            onClose={() => setActionsOpen(false)}
            sessionToken={sessionToken}
            businessId={activeBusiness}
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
        </>
      )}
    </PermissionGuard>
  );
}
