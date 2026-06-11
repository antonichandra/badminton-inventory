import type { SelectOption } from "../forms/types";

export type FilterOptionSource = "static" | "roles" | "businesses" | "sports";

export interface BaseFilterField {
  key: string;
  label: string;
  className?: string;
  colSpan?: number;
}

export interface TextFilterField extends BaseFilterField {
  type: "text";
  placeholder?: string;
  settings?: {
    inputType?: "text" | "email" | "search";
  };
}

export interface NumberFilterField extends BaseFilterField {
  type: "number";
  placeholder?: string;
}

export interface PhoneFilterField extends BaseFilterField {
  type: "phone";
  placeholder?: string;
}

export interface DateFilterField extends BaseFilterField {
  type: "date";
}

export interface TextareaFilterField extends BaseFilterField {
  type: "textarea";
  placeholder?: string;
  settings?: {
    rows?: number;
  };
}

export interface SingleDropdownFilterField extends BaseFilterField {
  type: "single-dropdown";
  placeholder?: string;
  settings?: {
    searchable?: boolean;
    searchPlaceholder?: string;
    clearable?: boolean;
    optionSource?: FilterOptionSource;
    options?: SelectOption[];
    emptyMessage?: string;
  };
}

export interface MultiDropdownFilterField extends BaseFilterField {
  type: "multi-dropdown";
  placeholder?: string;
  settings?: {
    searchable?: boolean;
    searchPlaceholder?: string;
    optionSource?: FilterOptionSource;
    options?: SelectOption[];
    emptyMessage?: string;
    maxDisplayTags?: number;
  };
}

export type FilterFieldConfig =
  | TextFilterField
  | NumberFilterField
  | PhoneFilterField
  | DateFilterField
  | TextareaFilterField
  | SingleDropdownFilterField
  | MultiDropdownFilterField;

export type FilterValues = Record<string, string | string[]>;

export interface FilterOptionMap {
  roles?: SelectOption[];
  businesses?: SelectOption[];
  sports?: SelectOption[];
}
