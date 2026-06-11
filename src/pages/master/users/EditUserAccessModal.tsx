import { useEffect, useState } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Dropdown } from "../../../core/components/forms/Dropdown";
import { Modal } from "../../../core/components/ui/Modal";
import { Button } from "../../../core/components/ui/Button";

interface RoleOption {
  value: Id<"roles">;
  label: string;
}

interface StatusOption {
  value: "PENDING" | "APPROVED" | "REVOKED";
  label: string;
}

interface EditUserAccessModalProps {
  open: boolean;
  userName: string;
  currentStatus: "PENDING" | "APPROVED" | "REVOKED";
  currentRoleId: Id<"roles">;
  roleOptions: RoleOption[];
  statusOptions: StatusOption[];
  isSaving: boolean;
  labels: {
    title: string;
    description: string;
    status: string;
    statusPlaceholder: string;
    role: string;
    rolePlaceholder: string;
    roleEmpty: string;
    save: string;
    cancel: string;
  };
  onClose: () => void;
  onSave: (payload: {
    status: "PENDING" | "APPROVED" | "REVOKED";
    roleId: Id<"roles">;
  }) => void;
}

export function EditUserAccessModal({
  open,
  userName,
  currentStatus,
  currentRoleId,
  roleOptions,
  statusOptions,
  isSaving,
  labels,
  onClose,
  onSave,
}: EditUserAccessModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<
    "PENDING" | "APPROVED" | "REVOKED"
  >(currentStatus);
  const [selectedRoleId, setSelectedRoleId] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedStatus(currentStatus);
    setSelectedRoleId(currentRoleId);
  }, [open, currentStatus, currentRoleId]);

  const canSave = selectedRoleId !== "";

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
                onSave({
                  status: selectedStatus,
                  roleId: selectedRoleId as Id<"roles">,
                });
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
      <div className="flex flex-col gap-4">
        <Dropdown
          label={labels.status}
          options={statusOptions}
          value={selectedStatus}
          onChange={(value) =>
            setSelectedStatus(value as "PENDING" | "APPROVED" | "REVOKED")
          }
          placeholder={labels.statusPlaceholder}
          disabled={isSaving}
        />
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
      </div>
    </Modal>
  );
}
