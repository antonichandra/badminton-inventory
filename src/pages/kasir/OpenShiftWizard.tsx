import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { InputNumber } from "../../core/components/forms/InputNumber";
import { Dropdown } from "../../core/components/forms/Dropdown";
import { Button } from "../../core/components/ui/Button";
import { useLanguage } from "../../core/context/LanguageContext";
import { useToast } from "../../core/context/ToastContext";

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
        qty: stockQty[product._id] ?? "0",
      })),
    [products, stockQty],
  );

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
      const message =
        error instanceof Error &&
        error.message.startsWith("OPENING_UNIT_COST_REQUIRED:")
          ? translate("kasirOpeningUnitCostRequired").replace(
              "{name}",
              error.message.split(":").slice(1).join(":"),
            )
          : translate("unexpectedError");
      showToast({ type: "error", message });
    } finally {
      setIsSaving(false);
    }
  };

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
            <Button
              onClick={() => setStep(1)}
              disabled={!assignedStaffId}
            >
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
            <Button onClick={() => setStep(2)}>
              {translate("kasirContinue")}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 space-y-4">
          {products.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {translate("kasirNoProducts")}
            </p>
          ) : (
            <>
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
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                {stockRows.map((row) => (
                  <div
                    key={row.productId}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {row.name}
                      </p>
                      <p className="text-xs text-slate-500">{row.unit}</p>
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
                ))}
              </div>
            </>
          )}

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
