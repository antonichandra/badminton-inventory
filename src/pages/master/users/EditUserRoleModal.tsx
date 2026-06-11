import { useEffect, useState } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Dropdown } from "../../../core/components/forms/Dropdown";
import { Modal } from "../../../core/components/ui/Modal";
import { Button } from "../../../core/components/ui/Button";

interface RoleOption {
  value: Id<"roles">;
  label: string;
}

interface EditUserRoleModalProps {
  open: boolean;
  userName: string;
  currentRoleId: Id<"roles">;
  roleOptions: RoleOption[];
  isSaving: boolean;
  labels: {
    title: string;
    description: string;
    role: string;
    rolePlaceholder: string;
    roleEmpty: string;
    save: string;
    cancel: string;
  };
  onClose: () => void;
  onSave: (roleId: Id<"roles">) => void;
}

export function EditUserRoleModal({
  open,
  userName,
  currentRoleId,
  roleOptions,
  isSaving,
  labels,
  onClose,
  onSave,
}: EditUserRoleModalProps) {
  const [selectedRoleId, setSelectedRoleId] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedRoleId(currentRoleId);
  }, [open, currentRoleId]);

  const canSave = selectedRoleId !== "" && selectedRoleId !== currentRoleId;

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
              if (selectedRoleId) {
                onSave(selectedRoleId as Id<"roles">);
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
        label={labels.role}
        options={roleOptions}
        value={selectedRoleId}
        onChange={setSelectedRoleId}
        placeholder={labels.rolePlaceholder}
        emptyMessage={labels.roleEmpty}
        disabled={isSaving || roleOptions.length === 0}
        searchPlaceholder={labels.role}
      />
    </Modal>
  );
}
