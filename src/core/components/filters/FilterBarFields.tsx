import { InputDate } from "../forms/InputDate";
import { InputNumber } from "../forms/InputNumber";
import { InputPhone } from "../forms/InputPhone";
import { InputText } from "../forms/InputText";
import { Textarea } from "../forms/Textarea";
import { Dropdown } from "../forms/Dropdown";
import { MultiDropdown } from "../forms/MultiDropdown";
import { cn } from "../../utils/cn";
import type { SelectOption } from "../forms/types";
import type {
  FilterFieldConfig,
  FilterOptionMap,
  FilterValues,
} from "./types";

function resolveOptions(
  field: FilterFieldConfig,
  optionMap: FilterOptionMap,
): SelectOption[] {
  if (field.type !== "single-dropdown" && field.type !== "multi-dropdown") {
    return [];
  }

  const source = field.settings?.optionSource ?? "static";
  if (source === "roles") return optionMap.roles ?? [];
  if (source === "businesses") return optionMap.businesses ?? [];
  if (source === "sports") return optionMap.sports ?? [];
  return field.settings?.options ?? [];
}

interface FilterBarFieldsProps {
  fields: FilterFieldConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  optionMap?: FilterOptionMap;
  layout?: "grid" | "stack";
}

export function FilterBarFields({
  fields,
  values,
  onChange,
  optionMap = {},
  layout = "grid",
}: FilterBarFieldsProps) {
  const updateValue = (key: string, value: string | string[]) => {
    onChange({ ...values, [key]: value });
  };

  const renderField = (field: FilterFieldConfig) => {
    const value = values[field.key];

    switch (field.type) {
      case "text":
        return (
          <InputText
            label={field.label}
            placeholder={field.placeholder}
            value={typeof value === "string" ? value : ""}
            onChange={(next) => updateValue(field.key, next)}
            type={field.settings?.inputType ?? "text"}
          />
        );
      case "number":
        return (
          <InputNumber
            label={field.label}
            placeholder={field.placeholder}
            value={typeof value === "string" ? value : ""}
            onChange={(next) => updateValue(field.key, next)}
          />
        );
      case "phone":
        return (
          <InputPhone
            label={field.label}
            placeholder={field.placeholder}
            value={typeof value === "string" ? value : ""}
            onChange={(next) => updateValue(field.key, next)}
          />
        );
      case "date":
        return (
          <InputDate
            label={field.label}
            value={typeof value === "string" ? value : ""}
            onChange={(next) => updateValue(field.key, next)}
          />
        );
      case "textarea":
        return (
          <Textarea
            label={field.label}
            placeholder={field.placeholder}
            rows={field.settings?.rows}
            value={typeof value === "string" ? value : ""}
            onChange={(next) => updateValue(field.key, next)}
          />
        );
      case "single-dropdown":
        return (
          <Dropdown
            label={field.label}
            placeholder={field.placeholder}
            options={resolveOptions(field, optionMap)}
            value={typeof value === "string" ? value : ""}
            onChange={(next) => updateValue(field.key, next)}
            searchable={field.settings?.searchable}
            searchPlaceholder={field.settings?.searchPlaceholder}
            clearable={field.settings?.clearable}
            emptyMessage={field.settings?.emptyMessage}
          />
        );
      case "multi-dropdown":
        return (
          <MultiDropdown
            label={field.label}
            placeholder={field.placeholder}
            options={resolveOptions(field, optionMap)}
            value={Array.isArray(value) ? value : []}
            onChange={(next) => updateValue(field.key, next)}
            searchable={field.settings?.searchable}
            searchPlaceholder={field.settings?.searchPlaceholder}
            emptyMessage={field.settings?.emptyMessage}
            maxDisplayTags={field.settings?.maxDisplayTags}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        layout === "grid"
          ? "grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          : "flex flex-col gap-4",
      )}
    >
      {fields.map((field) => (
        <div key={field.key} className={cn(field.className)}>
          {renderField(field)}
        </div>
      ))}
    </div>
  );
}
