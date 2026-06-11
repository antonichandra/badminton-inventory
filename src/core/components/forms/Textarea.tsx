import { cn } from "../../utils/cn";
import { FieldWrapper } from "./FieldWrapper";
import { fieldBaseClass, fieldErrorClass } from "./fieldStyles";

interface TextareaProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}

export function Textarea({
  label,
  hint,
  error,
  required,
  className,
  value,
  onChange,
  placeholder,
  disabled,
  rows = 4,
}: TextareaProps) {
  return (
    <FieldWrapper
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <textarea
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          fieldBaseClass,
          "min-h-[96px] resize-y",
          error && fieldErrorClass,
        )}
      />
    </FieldWrapper>
  );
}
