import type { ReactNode } from "react";

export type SelectOptionVariant = "sport" | "plan" | "business";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
  sportSlug?: string;
  planName?: string;
  variant?: SelectOptionVariant;
}

export interface FieldWrapperProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}
