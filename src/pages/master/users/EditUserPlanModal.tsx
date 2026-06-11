import { useEffect, useState } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Dropdown } from "../../../core/components/forms/Dropdown";
import { Modal } from "../../../core/components/ui/Modal";
import { Button } from "../../../core/components/ui/Button";

interface PlanOption {
  value: Id<"plans">;
  label: string;
}

interface EditUserPlanModalProps {
  open: boolean;
  userName: string;
  currentPlanId: Id<"plans"> | null;
  planOptions: PlanOption[];
  isSaving: boolean;
  labels: {
    title: string;
    description: string;
    plan: string;
    planPlaceholder: string;
    noPlan: string;
    save: string;
    cancel: string;
  };
  onClose: () => void;
  onSave: (planId: Id<"plans">) => void;
}

export function EditUserPlanModal({
  open,
  userName,
  currentPlanId,
  planOptions,
  isSaving,
  labels,
  onClose,
  onSave,
}: EditUserPlanModalProps) {
  const [selectedPlanId, setSelectedPlanId] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedPlanId(currentPlanId ?? planOptions[0]?.value ?? "");
  }, [open, currentPlanId, planOptions]);

  const canSave = selectedPlanId !== "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={labels.title}
      description={labels.description.replace("{name}", userName)}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            {labels.cancel}
          </Button>
          <Button
            onClick={() => {
              if (selectedPlanId) {
                onSave(selectedPlanId as Id<"plans">);
              }
            }}
            loading={isSaving}
            disabled={!canSave}
          >
            {labels.save}
          </Button>
        </>
      }
    >
      <Dropdown
        label={labels.plan}
        options={planOptions}
        value={selectedPlanId}
        onChange={setSelectedPlanId}
        placeholder={labels.planPlaceholder}
        emptyMessage={labels.noPlan}
        disabled={isSaving || planOptions.length === 0}
        searchPlaceholder={labels.plan}
      />
    </Modal>
  );
}
