import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Dropdown } from "../../../core/components/forms/Dropdown";
import { InputText } from "../../../core/components/forms/InputText";
import { Textarea } from "../../../core/components/forms/Textarea";
import { Modal } from "../../../core/components/ui/Modal";
import { Button } from "../../../core/components/ui/Button";
import { useLanguage } from "../../../core/context/LanguageContext";
import type { SupplierRow } from "./suppliers.config";

interface SupplierFormModalProps {
  open: boolean;
  onClose: () => void;
  sessionToken: string;
  supplier?: SupplierRow | null;
  onSuccess: () => void;
}

export function SupplierFormModal({
  open,
  onClose,
  sessionToken,
  supplier,
  onSuccess,
}: SupplierFormModalProps) {
  const { translate } = useLanguage();
  const createSupplier = useMutation(api.suppliers.createSupplier);
  const updateSupplier = useMutation(api.suppliers.updateSupplier);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (supplier) {
      setName(supplier.name);
      setDescription(supplier.description ?? "");
      setContact(supplier.contact ?? "");
      setIsActive(supplier.isActive);
    } else {
      setName("");
      setDescription("");
      setContact("");
      setIsActive(true);
    }
    setError(null);
  }, [open, supplier]);

  const handleSubmit = async () => {
    setIsSaving(true);
    setError(null);

    try {
      if (supplier) {
        await updateSupplier({
          sessionToken,
          supplierId: supplier._id as Id<"suppliers">,
          name,
          description: description || undefined,
          contact: contact || undefined,
          isActive,
        });
      } else {
        await createSupplier({
          sessionToken,
          name,
          description: description || undefined,
          contact: contact || undefined,
        });
      }

      onSuccess();
      onClose();
    } catch (submitError) {
      console.error(submitError);
      setError(translate("unexpectedError"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={supplier ? translate("supplierEdit") : translate("supplierAdd")}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            {translate("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            loading={isSaving}
            disabled={isSaving || !name.trim()}
          >
            {translate("supplierSave")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <InputText
          label={translate("supplierColName")}
          value={name}
          onChange={setName}
          required
        />
        <Textarea
          label={translate("supplierColDescription")}
          value={description}
          onChange={setDescription}
        />
        <InputText
          label={translate("supplierColContact")}
          value={contact}
          onChange={setContact}
        />

        {supplier && (
          <Dropdown
            label={translate("supplierColStatus")}
            value={isActive ? "active" : "inactive"}
            onChange={(value) => setIsActive(value === "active")}
            options={[
              { value: "active", label: translate("supplierActive") },
              { value: "inactive", label: translate("supplierInactive") },
            ]}
          />
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </Modal>
  );
}
