import { cn } from "../../utils/cn";
import { FieldWrapper } from "./FieldWrapper";
import { fieldBaseClass, fieldErrorClass } from "./fieldStyles";

interface InputNumberProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export function InputNumber({
  label,
  hint,
  error,
  required,
  className,
  value,
  onChange,
  placeholder,
  disabled,
  min,
  max,
  step,
}: InputNumberProps) {
  return (
    <FieldWrapper
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <input
        type="number"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldBaseClass, error && fieldErrorClass)}
      />
    </FieldWrapper>
  );
}
