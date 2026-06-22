import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Clock,
  Package,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "../core/components/PageHeader";
import { LoadingState } from "../core/components/ui/LoadingState";
import { MetricCard } from "../core/components/ui/MetricCard";
import { Button } from "../core/components/ui/Button";
import { hasPermission } from "../core/config/menu";
import { useAuth } from "../core/context/AuthContext";
import { useBusiness } from "../core/context/BusinessContext";
import { useLanguage } from "../core/context/LanguageContext";
import { formatDateOnly, formatDateTime } from "../core/utils/formatDate";
import { formatGrowthPercent } from "./analytics/chartUtils";
import { formatRupiah } from "./kasir/utils";
import { navigateWithTransition } from "../core/utils/viewTransition";

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, role, sessionToken, acl } = useAuth();
  const { translate, language } = useLanguage();
  const { activeBusinessId } = useBusiness();
  const hasKasir = hasPermission(acl, "kasir");
  const hasAnalytics = hasPermission(acl, "analytics");
  const isAdmin = role?.name === "ADMIN";

  const kasirContext = useQuery(
    api.shifts.getKasirContext,
    sessionToken && hasKasir
      ? { sessionToken, businessId: activeBusinessId ?? undefined }
      : "skip",
  );
  const liveStats = useQuery(
    api.shifts.getShiftLiveStats,
    sessionToken && hasKasir && kasirContext?.openShift
      ? { sessionToken }
      : "skip",
  );
  const monthly = useQuery(
    api.reports.getMonthlyComparison,
    sessionToken && hasAnalytics
      ? { sessionToken, businessId: activeBusinessId ?? undefined }
      : "skip",
  );
  const lowStock = useQuery(
    api.reports.getLowStockProducts,
    sessionToken && hasKasir
      ? { sessionToken, businessId: activeBusinessId ?? undefined, maxQty: 5 }
      : "skip",
  );
  const expiring = useQuery(
    api.reports.getExpiringBatches,
    sessionToken && hasKasir
      ? {
          sessionToken,
          businessId: activeBusinessId ?? undefined,
          limit: 5,
        }
      : "skip",
  );
  const recentShifts = useQuery(
    api.shifts.listShiftSummaries,
    sessionToken && hasKasir && activeBusinessId
      ? { sessionToken, businessId: activeBusinessId, limit: 3 }
      : "skip",
  );
  const quotaSummary = useQuery(
    api.businesses.getQuotaSummary,
    sessionToken && isAdmin ? { sessionToken } : "skip",
  );

  const loadingKpis = Boolean(
    hasKasir &&
      (kasirContext === undefined ||
        (hasAnalytics && monthly === undefined) ||
        (kasirContext?.openShift && liveStats === undefined)),
  );

  const monthGrowth =
    monthly != null
      ? formatGrowthPercent(monthly.thisMonth, monthly.lastMonth)
      : null;

  const shiftOpen = kasirContext?.openShift != null;
  const shiftPending = kasirContext?.shiftStatus === "CLOSE_PENDING";
  const pendingCloseCount = kasirContext?.pendingCloseCount ?? 0;

  const outOfStock = (lowStock ?? []).filter((item) => item.qtyOnHand === 0);
  const lowStockItems = (lowStock ?? []).filter((item) => item.qtyOnHand > 0);
  const alertCount =
    outOfStock.length +
    (pendingCloseCount > 0 ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={translate("dashboardTitle")}
        subtitle={translate("dashboardSubtitle")}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-base font-semibold text-slate-900 sm:text-lg dark:text-white">
          {translate("dashboardWelcome")}, {user?.name}!
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {translate("dashboardRoleLabel")}:{" "}
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
            {role?.name}
          </span>
        </p>
      </div>

      {hasKasir && kasirContext !== undefined && (
        <section
          className={`rounded-xl border p-4 shadow-sm ${
            shiftPending
              ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30"
              : shiftOpen
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
                : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p
                className={`text-sm font-semibold ${
                  shiftPending
                    ? "text-amber-900 dark:text-amber-200"
                    : shiftOpen
                      ? "text-emerald-900 dark:text-emerald-200"
                      : "text-slate-900 dark:text-white"
                }`}
              >
                {shiftPending
                  ? translate("dashboardShiftPending")
                  : shiftOpen
                    ? translate("dashboardShiftOpen")
                    : translate("dashboardShiftNone")}
              </p>
              {shiftOpen && kasirContext.openShift && (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {translate("dashboardOnDuty")}:{" "}
                  {kasirContext.assignedStaff?.name ?? "—"} ·{" "}
                  {formatDateTime(kasirContext.openShift.openedAt, language)}
                </p>
              )}
              {pendingCloseCount > 0 && (
                <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                  {pendingCloseCount} {translate("dashboardPendingClose")}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {shiftPending && kasirContext.canManageShift && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void navigateWithTransition(navigate, "/kasir")}
                >
                  {translate("dashboardReviewClose")}
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => void navigateWithTransition(navigate, "/kasir")}
              >
                  {shiftOpen
                    ? translate("dashboardOpenKasir")
                    : translate("dashboardOpenShift")}
              </Button>
            </div>
          </div>
        </section>
      )}

      {hasKasir && (
        <div
          className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-2"}`}
        >
          <MetricCard
            label={translate("dashboardTodayRevenue")}
            value={formatRupiah(
              liveStats?.totalRevenue ?? liveStats?.paidRevenue ?? 0,
            )}
            icon={Banknote}
            iconClassName="bg-emerald-500 text-white"
            loading={loadingKpis}
          />
          {isAdmin && (
            <>
              <MetricCard
                label={translate("dashboardGrossProfit")}
                value={formatRupiah(liveStats?.grossProfit ?? 0)}
                icon={TrendingUp}
                iconClassName="bg-indigo-500 text-white"
                loading={loadingKpis}
              />
              <MetricCard
                label={translate("dashboardMonthRevenue")}
                value={formatRupiah(monthly?.thisMonth ?? 0)}
                icon={ShoppingCart}
                iconClassName="bg-violet-500 text-white"
                delta={
                  monthGrowth
                    ? {
                        text: `${monthGrowth.text} ${translate("dashboardVsLastMonth")}`,
                        tone: monthGrowth.tone,
                      }
                    : undefined
                }
                loading={loadingKpis}
              />
            </>
          )}
          <MetricCard
            label={translate("dashboardUnpaid")}
            value={formatRupiah(liveStats?.unpaidRevenue ?? 0)}
            icon={Wallet}
            iconClassName="bg-amber-500 text-white"
            loading={loadingKpis}
          />
        </div>
      )}

      {hasKasir && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {translate("dashboardAttention")}
              </h3>
              <div className="flex items-center gap-3">
                <Link
                  to="/stok"
                  viewTransition
                  className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  {translate("dashboardViewStock")}
                </Link>
                {hasAnalytics && (
                  <Link
                    to="/analytics"
                    viewTransition
                    className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    {translate("dashboardViewAnalytics")}
                  </Link>
                )}
              </div>
            </div>
            {lowStock === undefined ? (
              <LoadingState variant="inline" />
            ) : alertCount === 0 ? (
              <p className="text-sm text-slate-500">{translate("dashboardNoAlerts")}</p>
            ) : (
              <ul className="space-y-2">
                {pendingCloseCount > 0 && (
                  <li className="flex items-center gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/30">
                    <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                    <span className="flex-1">
                      {pendingCloseCount} {translate("dashboardPendingClose")}
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </li>
                )}
                {outOfStock.slice(0, 3).map((item) => (
                  <li
                    key={item.productId}
                    className="flex items-center gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm dark:bg-red-950/30"
                  >
                    <Package className="h-4 w-4 shrink-0 text-red-600" />
                    <span className="flex-1 font-medium">{item.productName}</span>
                    <span className="text-xs font-semibold text-red-600">
                      {translate("dashboardOutOfStock")}
                    </span>
                  </li>
                ))}
                {lowStockItems.slice(0, 3).map((item) => (
                  <li
                    key={item.productId}
                    className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span className="flex-1">{item.productName}</span>
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      {item.qtyOnHand} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {translate("dashboardTopProducts")}
            </h3>
            {!shiftOpen || !liveStats ? (
              <p className="text-sm text-slate-500">
                {shiftOpen ? "…" : translate("kasirNoOpenShift")}
              </p>
            ) : liveStats.topProducts.length === 0 ? (
              <p className="text-sm text-slate-500">{translate("kasirNoData")}</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {liveStats.topProducts.slice(0, 5).map((product) => (
                  <li
                    key={product.productId}
                    className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0"
                  >
                    <span className="font-medium text-slate-900 dark:text-white">
                      {product.productName}
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-400">
                      {product.qty} · {formatRupiah(product.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {hasKasir && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-900/20">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-semibold text-amber-800 dark:text-amber-300">
              {translate("dashboardExpiringSoon")}
            </h3>
            <div className="flex items-center gap-3">
              <Link
                to="/stok"
                viewTransition
                className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
              >
                {translate("dashboardViewStock")}
              </Link>
              {hasAnalytics && (
                <Link
                  to="/analytics"
                  viewTransition
                  className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
                >
                  {translate("dashboardViewAnalytics")}
                </Link>
              )}
            </div>
          </div>
          {expiring === undefined ? (
            <LoadingState variant="inline" />
          ) : expiring.length === 0 ? (
            <p className="text-sm text-amber-800/80 dark:text-amber-300/80">
              {translate("dashboardNoExpiring")}
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {expiring.map((batch, index) => (
                <li
                  key={`${batch.productId}-${batch.expiresAt}-${index}`}
                  className="flex justify-between gap-3 border-b border-amber-200/60 py-2 last:border-0 dark:border-amber-800/40"
                >
                  <span className="font-medium text-amber-950 dark:text-amber-100">
                    {batch.productName}
                  </span>
                  <span className="shrink-0 text-amber-900 dark:text-amber-200">
                    {batch.qtyRemaining} pcs ·{" "}
                    {formatDateOnly(batch.expiresAt!, language)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {hasKasir && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {translate("dashboardRecentShifts")}
          </h3>
          {recentShifts === undefined ? (
            <LoadingState variant="inline" />
          ) : recentShifts.length === 0 ? (
            <p className="text-sm text-slate-500">
              {translate("kasirNoShiftHistory")}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentShifts.map((summary) => (
                <li
                  key={summary.shiftId}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm first:pt-0"
                >
                  <span className="text-slate-600 dark:text-slate-400">
                    {formatDateTime(summary.closedAt, language)}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                    {formatRupiah(summary.totalRevenue)}
                    {isAdmin && "grossProfit" in summary && (
                      <>
                        {" · "}
                        <span className="font-normal text-emerald-600 dark:text-emerald-400">
                          {formatRupiah(summary.grossProfit)}
                        </span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {isAdmin && quotaSummary?.showQuota && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-4 sm:grid-cols-2">
            <QuotaBar
              label={translate("dashboardQuotaBusiness")}
              current={quotaSummary.businessCount}
              max={quotaSummary.maxBusiness}
            />
            <QuotaBar
              label={translate("dashboardQuotaStaff")}
              current={quotaSummary.staffCount}
              max={quotaSummary.maxStaff}
            />
          </div>
          {quotaSummary.planName && (
            <p className="mt-3 text-xs text-slate-500">
              Plan: {quotaSummary.planName}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function QuotaBar({
  label,
  current,
  max,
}: {
  label: string;
  current: number;
  max: number;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;

  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {label}
        </span>
        <span className="tabular-nums text-slate-500">
          {current}/{max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
