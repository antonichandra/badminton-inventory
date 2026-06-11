import type { SelectOption } from "../forms/types";
import type {
  FilterFieldConfig,
  FilterOptionMap,
  FilterValues,
} from "./types";

export interface AppliedFilterBadge {
  key: string;
  label: string;
  fieldLabel: string;
  valueLabel: string;
}

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

function getOptionLabel(options: SelectOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function buildAppliedFilterBadges(
  fields: FilterFieldConfig[],
  appliedValues: FilterValues,
  optionMap: FilterOptionMap,
): AppliedFilterBadge[] {
  const badges: AppliedFilterBadge[] = [];

  for (const field of fields) {
    const value = appliedValues[field.key];

    if (field.type === "multi-dropdown") {
      const selected = Array.isArray(value) ? value : [];
      if (selected.length === 0) continue;

      const options = resolveOptions(field, optionMap);
      const labels = selected
        .map((item) => getOptionLabel(options, item))
        .join(", ");

      badges.push({
        key: field.key,
        label: `${field.label}: ${labels}`,
        fieldLabel: field.label,
        valueLabel: labels,
      });
      continue;
    }

    if (typeof value !== "string" || !value.trim()) {
      continue;
    }

    if (field.type === "single-dropdown") {
      const options = resolveOptions(field, optionMap);
      const valueLabel = getOptionLabel(options, value);
      badges.push({
        key: field.key,
        label: `${field.label}: ${valueLabel}`,
        fieldLabel: field.label,
        valueLabel,
      });
      continue;
    }

    const valueLabel = value.trim();
    badges.push({
      key: field.key,
      label: `${field.label}: ${valueLabel}`,
      fieldLabel: field.label,
      valueLabel,
    });
  }

  return badges;
}

export function hasActiveFilters(
  fields: FilterFieldConfig[],
  appliedValues: FilterValues,
): boolean {
  return buildAppliedFilterBadges(fields, appliedValues, {}).length > 0 ||
    fields.some((field) => {
      const value = appliedValues[field.key];
      if (Array.isArray(value)) return value.length > 0;
      return typeof value === "string" && value.trim().length > 0;
    });
}
