import { cn } from "../../utils/cn";
import { FieldWrapper } from "./FieldWrapper";
import { fieldBaseClass, fieldErrorClass } from "./fieldStyles";

interface InputDateProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  min?: string;
  max?: string;
}

export function InputDate({
  label,
  hint,
  error,
  required,
  className,
  value,
  onChange,
  disabled,
  min,
  max,
}: InputDateProps) {
  return (
    <FieldWrapper
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <input
        type="date"
        value={value}
        disabled={disabled}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldBaseClass, error && fieldErrorClass)}
      />
    </FieldWrapper>
  );
}
