import { InputPhone } from "../../../core/components/forms/InputPhone";
import { InputText } from "../../../core/components/forms/InputText";
import { Dropdown } from "../../../core/components/forms/Dropdown";
import { Textarea } from "../../../core/components/forms/Textarea";
import type { SelectOption } from "../../../core/components/forms/types";

export interface BusinessFormValues {
  name: string;
  sportId: string;
  phone: string;
  address: string;
}

export type BusinessFormErrors = Partial<
  Pick<BusinessFormValues, "name" | "sportId" | "address">
>;

interface BusinessFormFieldsProps {
  values: BusinessFormValues;
  errors?: BusinessFormErrors;
  onChange: (values: BusinessFormValues) => void;
  sportOptions: SelectOption[];
  labels: {
    name: string;
    namePlaceholder: string;
    sport: string;
    sportPlaceholder: string;
    phone: string;
    phonePlaceholder: string;
    address: string;
    addressPlaceholder: string;
  };
  disabled?: boolean;
}

export function BusinessFormFields({
  values,
  errors = {},
  onChange,
  sportOptions,
  labels,
  disabled = false,
}: BusinessFormFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <InputText
          label={labels.name}
          placeholder={labels.namePlaceholder}
          value={values.name}
          onChange={(name) => onChange({ ...values, name })}
          disabled={disabled}
          required
          error={errors.name}
        />
      </div>

      <Dropdown
        label={labels.sport}
        placeholder={labels.sportPlaceholder}
        value={values.sportId}
        options={sportOptions}
        onChange={(sportId) => onChange({ ...values, sportId })}
        disabled={disabled}
        required
        error={errors.sportId}
      />

      <InputPhone
        label={labels.phone}
        placeholder={labels.phonePlaceholder}
        value={values.phone}
        onChange={(phone) => onChange({ ...values, phone })}
        disabled={disabled}
      />

      <div className="sm:col-span-2">
        <Textarea
          label={labels.address}
          placeholder={labels.addressPlaceholder}
          value={values.address}
          onChange={(address) => onChange({ ...values, address })}
          disabled={disabled}
          rows={3}
          required
          error={errors.address}
        />
      </div>
    </div>
  );
}

export function validateBusinessForm(
  values: BusinessFormValues,
  requiredMessage: string,
): BusinessFormErrors {
  const errors: BusinessFormErrors = {};

  if (!values.name.trim()) {
    errors.name = requiredMessage;
  }
  if (!values.sportId) {
    errors.sportId = requiredMessage;
  }
  if (!values.address.trim()) {
    errors.address = requiredMessage;
  }

  return errors;
}
