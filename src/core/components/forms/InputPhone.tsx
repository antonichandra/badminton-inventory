import { cn } from "../../utils/cn";
import { FieldWrapper } from "./FieldWrapper";
import { fieldBaseClass, fieldErrorClass } from "./fieldStyles";

interface InputPhoneProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function InputPhone({
  label,
  hint,
  error,
  required,
  className,
  value,
  onChange,
  placeholder = "+62 ...",
  disabled,
}: InputPhoneProps) {
  const handleChange = (raw: string) => {
    const sanitized = raw.replace(/[^\d+\s()-]/g, "");
    onChange(sanitized);
  };

  return (
    <FieldWrapper
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <input
        type="tel"
        inputMode="tel"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => handleChange(event.target.value)}
        className={cn(fieldBaseClass, error && fieldErrorClass)}
      />
    </FieldWrapper>
  );
}
