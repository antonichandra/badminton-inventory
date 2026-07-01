import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { InputNumber } from "../../core/components/forms/InputNumber";
import { PageHeader } from "../../core/components/PageHeader";
import { PageTopSection } from "../../core/components/PageTopSection";
import { PermissionGuard } from "../../core/components/PermissionGuard";
import { Button } from "../../core/components/ui/Button";
import { LoadingState } from "../../core/components/ui/LoadingState";
import { useAuth } from "../../core/context/AuthContext";
import { useBusiness } from "../../core/context/BusinessContext";
import { useLanguage } from "../../core/context/LanguageContext";
import { useToast } from "../../core/context/ToastContext";
import { formatDateTime } from "../../core/utils/formatDate";
import { groupByCategory } from "../../core/utils/groupByCategory";
import {
  computeStockCardItemResult,
  type StockCardFormItem,
} from "../../core/utils/stockCardReconciliation";
import {
  CategoryGroupSection,
  CategoryGroupsContainer,
} from "../../core/components/categoryGroup";
import {
  KasirTd,
  KasirTh,
  kasirCompactTableClass,
  kasirCompactTheadClass,
  kasirCompactTbodyClass,
  kasirCompactTrClass,
} from "../kasir/KasirTable";
import { ExportStockCardPdfButton } from "./ExportStockCardPdfButton";

function formatSnapshotHeader(timestamp: number, language: "ID" | "EN"): string {
  const date = new Date(timestamp);
  return date.toLocaleString(language === "ID" ? "id-ID" : "en-US", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toFormItem(item: {
  productId: Id<"products">;
  productName: string;
  categoryId?: Id<"productCategories">;
  categoryName: string;
  unit: string;
  openingQty: number;
  receivedQty: number;
  writeOffQty: number;
  soldQty: number;
  expectedQty: number;
}): StockCardFormItem {
  return item;
}

export function StockCardPage() {
  const navigate = useNavigate();
  const { translate, language } = useLanguage();
  const { showToast } = useToast();
  const { sessionToken } = useAuth();
  const { activeBusinessId } = useBusiness();
  const submitSnapshot = useMutation(api.stockCards.submitStockCardSnapshot);

  const pageData = useQuery(
    api.stockCards.getStockCardPageData,
    sessionToken
      ? { sessionToken, businessId: activeBusinessId ?? undefined }
      : "skip",
  );

  const [countedQty, setCountedQty] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const groups = useMemo(
    () => groupByCategory(pageData?.items ?? []),
    [pageData?.items],
  );

  const snapshots = pageData?.snapshots ?? [];

  const filledCount = useMemo(
    () =>
      Object.values(countedQty).filter((value) => value.trim() !== "").length,
    [countedQty],
  );

  const handleSubmit = async () => {
    if (!pageData || !sessionToken) return;

    const items = pageData.items
      .map((item) => {
        const raw = countedQty[item.productId];
        if (raw === undefined || raw.trim() === "") return null;
        return {
          productId: item.productId,
          countedQty: Number(raw.replace(/\D/g, "")) || 0,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (items.length === 0) {
      showToast({
        type: "error",
        message: translate("stockCardNoItems"),
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await submitSnapshot({
        sessionToken,
        businessId: activeBusinessId ?? undefined,
        items,
      });
      showToast({
        type: "success",
        message: translate("stockCardSaved")
          .replace("{miss}", String(result.missInputQtyTotal))
          .replace("{over}", String(result.overInputQtyTotal)),
      });
      setCountedQty({});
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: translate("unexpectedError") });
    } finally {
      setIsSaving(false);
    }
  };

  if (!sessionToken) {
    return <Navigate to="/login" replace />;
  }

  if (pageData === null) {
    return <Navigate to="/stok" replace />;
  }

  return (
    <PermissionGuard permission="kasir">
      <PageTopSection>
        <div className="min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate("/stok")}
          >
            {translate("stockCardBackToInventory")}
          </Button>
          <PageHeader
            embedded
            title={translate("stockCardPageTitle")}
            subtitle={
              pageData
                ? `${pageData.businessName} · ${translate("kasirShiftOpenedAt")}: ${formatDateTime(pageData.shiftOpenedAt, language)}`
                : translate("stockCardDesc")
            }
          />
        </div>
        {pageData?.canExportPdf && (
          <ExportStockCardPdfButton
            sessionToken={sessionToken}
            businessId={activeBusinessId ?? undefined}
          />
        )}
      </PageTopSection>

      {pageData === undefined ? (
        <LoadingState variant="page" className="py-12" />
      ) : pageData.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <p className="text-slate-500">{translate("stockCardEmpty")}</p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-xs text-slate-500">{translate("stockCardHint")}</p>

          <CategoryGroupsContainer>
            {groups.map((group) => (
              <CategoryGroupSection
                key={group.categoryId ?? group.categoryName}
                categoryName={group.categoryName}
                itemCount={group.items.length}
                defaultExpanded
              >
                <div className="overflow-x-auto">
                  <table className={kasirCompactTableClass}>
                    <thead className={kasirCompactTheadClass}>
                      <tr>
                        <KasirTh className="min-w-[10rem] sticky left-0 z-10 bg-slate-50 dark:bg-slate-800">
                          {translate("inventoryColProduct")}
                        </KasirTh>
                        <KasirTh className="min-w-[4.5rem] text-center">
                          {translate("stockCardOpeningQty")}
                        </KasirTh>
                        {snapshots.map((snapshot) => (
                          <KasirTh
                            key={snapshot._id}
                            className="min-w-[5rem] text-center text-xs"
                          >
                            {formatSnapshotHeader(snapshot.recordedAt, language)}
                          </KasirTh>
                        ))}
                        <KasirTh className="min-w-[5.5rem] bg-emerald-50 text-center dark:bg-emerald-950/30">
                          {translate("stockCardNewInput")}
                        </KasirTh>
                        <KasirTh className="min-w-[6rem] text-center">
                          {translate("stockCardWarning")}
                        </KasirTh>
                      </tr>
                    </thead>
                    <tbody className={kasirCompactTbodyClass}>
                      {group.items.map((item) => {
                        const raw = countedQty[item.productId] ?? "";
                        const hasValue = raw.trim() !== "";
                        const parsed = hasValue
                          ? Number(raw.replace(/\D/g, "")) || 0
                          : null;
                        const preview =
                          parsed !== null
                            ? computeStockCardItemResult(
                                toFormItem(item),
                                parsed,
                              )
                            : null;

                        return (
                          <tr
                            key={item.productId}
                            className={kasirCompactTrClass}
                          >
                            <KasirTd className="sticky left-0 z-10 bg-white dark:bg-slate-900">
                              <span className="font-medium">
                                {item.productName}
                              </span>
                              <span className="ml-1 text-xs text-slate-400">
                                ({item.unit})
                              </span>
                            </KasirTd>
                            <KasirTd className="text-center tabular-nums">
                              {item.openingQty}
                            </KasirTd>
                            {snapshots.map((snapshot) => {
                              const cell =
                                snapshot.itemsByProduct[item.productId];
                              return (
                                <KasirTd
                                  key={snapshot._id}
                                  className="text-center tabular-nums"
                                >
                                  {cell ? (
                                    <HistoryCell
                                      countedQty={cell.countedQty}
                                      missInputQty={cell.missInputQty}
                                      overInputQty={cell.overInputQty}
                                    />
                                  ) : (
                                    "—"
                                  )}
                                </KasirTd>
                              );
                            })}
                            <KasirTd className="min-w-[5.5rem] bg-emerald-50/50 dark:bg-emerald-950/10">
                              <InputNumber
                                value={raw}
                                onChange={(value) =>
                                  setCountedQty((prev) => ({
                                    ...prev,
                                    [item.productId]: value,
                                  }))
                                }
                                format="plain"
                                hideSpinner
                                variant="inline"
                                className="text-center"
                              />
                            </KasirTd>
                            <KasirTd className="text-center text-xs">
                              {preview ? (
                                <VarianceCell
                                  variance={preview.variance}
                                  missInputQty={preview.missInputQty}
                                  overInputQty={preview.overInputQty}
                                />
                              ) : (
                                "—"
                              )}
                            </KasirTd>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CategoryGroupSection>
            ))}
          </CategoryGroupsContainer>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSubmit} loading={isSaving}>
              {translate("stockCardSubmit")} ({filledCount})
            </Button>
          </div>
        </>
      )}
    </PermissionGuard>
  );
}

function HistoryCell({
  countedQty,
  missInputQty,
  overInputQty,
}: {
  countedQty: number;
  missInputQty: number;
  overInputQty: number;
}) {
  const { translate } = useLanguage();
  const hasWarning = missInputQty > 0 || overInputQty > 0;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span>{countedQty}</span>
      {hasWarning && (
        <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
          {missInputQty > 0
            ? `${translate("kasirMissInput")} ${missInputQty}`
            : `${translate("kasirOverInput")} ${overInputQty}`}
        </span>
      )}
    </div>
  );
}

function VarianceCell({
  variance,
  missInputQty,
  overInputQty,
}: {
  variance: number;
  missInputQty: number;
  overInputQty: number;
}) {
  const { translate } = useLanguage();

  if (missInputQty > 0) {
    return (
      <span className="font-medium text-amber-700 dark:text-amber-300">
        {translate("kasirMissInput")} {missInputQty}
      </span>
    );
  }
  if (overInputQty > 0) {
    return (
      <span className="font-medium text-orange-700 dark:text-orange-300">
        {translate("kasirOverInput")} {overInputQty}
      </span>
    );
  }
  if (variance === 0) {
    return (
      <span className="text-emerald-700 dark:text-emerald-300">
        {translate("kasirStaffExact")}
      </span>
    );
  }

  return (
    <span className="tabular-nums">
      {variance > 0 ? `+${variance}` : variance}
    </span>
  );
}
