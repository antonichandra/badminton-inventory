import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { InputNumber } from "../../../core/components/forms/InputNumber";
import { InputText } from "../../../core/components/forms/InputText";
import { Modal } from "../../../core/components/ui/Modal";
import { Button } from "../../../core/components/ui/Button";
import { useLanguage } from "../../../core/context/LanguageContext";
import type { CategoryRow } from "./categories.config";

interface CategoryFormModalProps {
  open: boolean;
  onClose: () => void;
  sessionToken: string;
  category?: CategoryRow | null;
  onSuccess: () => void;
}

export function CategoryFormModal({
  open,
  onClose,
  sessionToken,
  category,
  onSuccess,
}: CategoryFormModalProps) {
  const { translate } = useLanguage();
  const createCategory = useMutation(api.productCategories.createCategory);
  const updateCategory = useMutation(api.productCategories.updateCategory);

  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (category) {
      setName(category.name);
      setSortOrder(
        category.sortOrder != null ? String(category.sortOrder) : "",
      );
      setIsActive(category.isActive);
    } else {
      setName("");
      setSortOrder("");
      setIsActive(true);
    }
    setError(null);
  }, [open, category]);

  const handleSubmit = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const sortOrderValue = sortOrder.trim()
        ? Number(sortOrder)
        : undefined;

      if (category) {
        await updateCategory({
          sessionToken,
          categoryId: category._id,
          name,
          sortOrder: sortOrderValue,
          isActive,
        });
      } else {
        await createCategory({
          sessionToken,
          name,
          sortOrder: sortOrderValue,
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
      title={
        category
          ? translate("categoryEdit")
          : translate("categoryAdd")
      }
    >
      <div className="space-y-4">
        <InputText
          label={translate("categoryColName")}
          value={name}
          onChange={setName}
          required
        />
        <InputNumber
          label={translate("categorySortOrder")}
          value={sortOrder}
          onChange={setSortOrder}
          min={0}
          placeholder={translate("categorySortOrderPlaceholder")}
        />
        {category && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="rounded border-slate-300"
            />
            {translate("categoryActive")}
          </label>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {translate("cancel")}
          </Button>
          <Button onClick={handleSubmit} loading={isSaving} disabled={!name.trim()}>
            {translate("categorySave")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
