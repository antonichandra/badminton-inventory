import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CategoryGroupedList } from "../../core/components/CategoryGroupedList";
import { InputNumber } from "../../core/components/forms/InputNumber";
import { Dropdown } from "../../core/components/forms/Dropdown";
import { Button } from "../../core/components/ui/Button";
import { useLanguage } from "../../core/context/LanguageContext";
import { useToast } from "../../core/context/ToastContext";
import { groupByCategory } from "../../core/utils/groupByCategory";

type BusinessId = Id<"businesses">;

interface OpenShiftWizardProps {
  sessionToken: string;
  businessId: BusinessId;
  onComplete: () => void;
}

export function OpenShiftWizard({
  sessionToken,
  businessId,
  onComplete,
}: OpenShiftWizardProps) {
  const { translate } = useLanguage();
  const { showToast } = useToast();
  const openShift = useMutation(api.shifts.openShift);

  const assigneeData = useQuery(api.shifts.listShiftAssignees, {
    sessionToken,
    businessId,
  });
  const retailProducts = useQuery(api.products.listRetailProductsForShift, {
    sessionToken,
    businessId,
  });

  const suggestedOpening = useQuery(api.shifts.getSuggestedOpeningStock, {
    sessionToken,
    businessId,
  });

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [openingCash, setOpeningCash] = useState("0");
  const [stockQty, setStockQty] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const assignees = assigneeData?.assignees ?? [];
  const usesOwnerFallback = assigneeData?.usesOwnerFallback ?? false;
  const products = retailProducts ?? [];
  const productsLoaded = retailProducts !== undefined;
  const hasProducts = products.length > 0;

  const assigneeOptions = useMemo(
    () =>
      assignees.map((assignee) => ({
        value: assignee._id,
        label: assignee.name,
        email: assignee.email,
        picture: assignee.picture,
        roleName: assignee.roleName,
        variant: "user" as const,
      })),
    [assignees],
  );

  useEffect(() => {
    if (assignees.length === 1) {
      setAssignedStaffId(assignees[0]._id);
    }
  }, [assignees]);

  const stockRows = useMemo(
    () =>
      products.map((product) => ({
        productId: product._id,
        name: product.name,
        unit: product.unit,
        categoryId: product.categoryId,
        categoryName: product.categoryName,
        qty: stockQty[product._id] ?? "0",
      })),
    [products, stockQty],
  );

  const stockGroups = useMemo(() => groupByCategory(stockRows), [stockRows]);

  useEffect(() => {
    if (!suggestedOpening?.length || products.length === 0) return;
    setStockQty((prev) => {
      const hasValues = Object.values(prev).some((value) => Number(value) > 0);
      if (hasValues) return prev;
      const next: Record<string, string> = {};
      for (const product of products) {
        const suggested = suggestedOpening.find(
          (item) => item.productId === product._id,
        );
        next[product._id] = String(suggested?.qty ?? 0);
      }
      return next;
    });
  }, [suggestedOpening, products]);

  const handleFillSuggested = () => {
    const next: Record<string, string> = {};
    for (const product of products) {
      const suggested = suggestedOpening?.find(
        (item) => item.productId === product._id,
      );
      next[product._id] = String(suggested?.qty ?? 0);
    }
    setStockQty(next);
  };

  const handleFillZero = () => {
    const next: Record<string, string> = {};
    for (const product of products) {
      next[product._id] = "0";
    }
    setStockQty(next);
  };

  const handleOpenShift = async () => {
    setIsSaving(true);
    try {
      await openShift({
        sessionToken,
        assignedStaffId: assignedStaffId as Id<"users">,
        openingCash: Number(openingCash) || 0,
        openingStock: stockRows.map((row) => ({
          productId: row.productId as Id<"products">,
          qty: Number(row.qty) || 0,
        })),
      });
      showToast({
        type: "success",
        message: translate("kasirShiftOpened"),
      });
      onComplete();
    } catch (error) {
      console.error(error);
      let message = translate("unexpectedError");
      if (error instanceof Error) {
        if (error.message.startsWith("OPENING_UNIT_COST_REQUIRED:")) {
          message = translate("kasirOpeningUnitCostRequired").replace(
            "{name}",
            error.message.split(":").slice(1).join(":"),
          );
        } else if (error.message === "NO_RETAIL_PRODUCTS") {
          message = translate("kasirNoProductsBlock");
        }
      }
      showToast({ type: "error", message });
    } finally {
      setIsSaving(false);
    }
  };

  if (productsLoaded && !hasProducts) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-800 dark:bg-amber-900/20">
        <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
          {translate("kasirOpenShiftTitle")}
        </h2>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
          {translate("kasirNoProductsBlock")}
        </p>
        <div className="mt-4">
          <Link
            to="/master/produk"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-transparent bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            {translate("kasirGoToProducts")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
        {translate("kasirOpenShiftTitle")}
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {translate("kasirOpenShiftDesc")}
      </p>

      {step === 0 && (
        <div className="mt-6 space-y-4">
          {usesOwnerFallback && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              {translate("kasirNoStaffFallbackHint")}
            </p>
          )}
          <Dropdown
            label={translate("kasirSelectStaff")}
            value={assignedStaffId}
            onChange={setAssignedStaffId}
            options={assigneeOptions}
            searchable
            required
            emptyMessage={translate("kasirNoStaff")}
          />
          <div className="flex justify-end">
            <Button onClick={() => setStep(1)} disabled={!assignedStaffId}>
              {translate("kasirContinue")}
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="mt-6 space-y-4">
          <InputNumber
            label={translate("kasirOpeningCash")}
            value={openingCash}
            onChange={setOpeningCash}
            min={0}
            format="currency"
            required
          />
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>
              {translate("cancel")}
            </Button>
            <Button onClick={() => setStep(2)}>{translate("kasirContinue")}</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 space-y-4">
          <div className="flex justify-end gap-2">
            {suggestedOpening && suggestedOpening.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleFillSuggested}>
                {translate("kasirFillSuggested")}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleFillZero}>
              {translate("kasirFillZero")}
            </Button>
          </div>

          <CategoryGroupedList
            groups={stockGroups}
            itemCountLabel={(count) =>
              translate("categoryItemCount").replace("{count}", String(count))
            }
            renderItem={(row) => (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-900 dark:text-white">
                    {row.name}
                  </p>
                  <p className="text-[10px] text-slate-500">{row.unit}</p>
                </div>
                <InputNumber
                  variant="inline"
                  value={row.qty}
                  onChange={(value) =>
                    setStockQty((prev) => ({
                      ...prev,
                      [row.productId]: value,
                    }))
                  }
                  min={0}
                />
              </div>
            )}
          />

          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              {translate("cancel")}
            </Button>
            <Button onClick={handleOpenShift} loading={isSaving}>
              {translate("kasirOpenShift")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
