import { FieldWrapper } from "./FieldWrapper";
import { DropdownPanel } from "./DropdownPanel";
import type { SelectOption } from "./types";

interface DropdownProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  emptyMessage?: string;
}

export function Dropdown({
  label,
  hint,
  error,
  required,
  className,
  options,
  value,
  onChange,
  placeholder,
  searchable,
  searchPlaceholder,
  disabled,
  clearable,
  emptyMessage,
}: DropdownProps) {
  return (
    <FieldWrapper
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <DropdownPanel
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        disabled={disabled}
        clearable={clearable}
        emptyMessage={emptyMessage}
      />
    </FieldWrapper>
  );
}
