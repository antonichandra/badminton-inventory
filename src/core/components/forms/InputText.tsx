import { cn } from "../../utils/cn";
import { FieldWrapper } from "./FieldWrapper";
import { fieldBaseClass, fieldErrorClass } from "./fieldStyles";

interface InputTextProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: "text" | "email" | "password" | "search";
}

export function InputText({
  label,
  hint,
  error,
  required,
  className,
  inputClassName,
  value,
  onChange,
  placeholder,
  disabled,
  type = "text",
}: InputTextProps) {
  return (
    <FieldWrapper
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldBaseClass, error && fieldErrorClass, inputClassName)}
      />
    </FieldWrapper>
  );
}
