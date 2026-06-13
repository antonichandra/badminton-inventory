import { useState } from "react";
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
  hideSpinner?: boolean;
  format?: "plain" | "currency";
  variant?: "default" | "inline";
}

function formatCurrencyDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const num = Number(digits);
  if (Number.isNaN(num)) return "";
  return new Intl.NumberFormat("id-ID").format(num);
}

const noSpinnerClass =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

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
  hideSpinner = true,
  format = "plain",
  variant = "default",
}: InputNumberProps) {
  const [focused, setFocused] = useState(false);
  const isCurrency = format === "currency";
  const isInline = variant === "inline";

  const displayValue =
    isCurrency && !focused ? formatCurrencyDisplay(value) : value;

  const handleChange = (raw: string) => {
    if (isCurrency) {
      onChange(raw.replace(/\D/g, ""));
      return;
    }
    onChange(raw);
  };

  const input = (
    <input
      type={isCurrency ? "text" : "number"}
      inputMode={isCurrency ? "numeric" : undefined}
      value={displayValue}
      disabled={disabled}
      placeholder={placeholder}
      min={isCurrency ? undefined : min}
      max={isCurrency ? undefined : max}
      step={isCurrency ? undefined : step}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) => handleChange(event.target.value)}
      className={cn(
        isInline
          ? "h-8 w-20 rounded border border-slate-200 px-2 text-right text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          : fieldBaseClass,
        error && fieldErrorClass,
        !isCurrency && hideSpinner && noSpinnerClass,
        !isInline && className,
      )}
    />
  );

  if (isInline) {
    return input;
  }

  return (
    <FieldWrapper
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      {input}
    </FieldWrapper>
  );
}
