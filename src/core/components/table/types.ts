import type { ReactNode } from "react";

export type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

export interface BadgeCellConfig<T> {
  type: "badge";
  key: string;
  label: string;
  className?: string;
  headerClassName?: string;
  getValue: (row: T) => string;
  getVariant?: (row: T) => BadgeVariant;
}

export interface DisplayCellConfig<T> {
  type: "display";
  key: string;
  label: string;
  className?: string;
  headerClassName?: string;
  getValue: (row: T) => string;
}

export interface CustomCellConfig<T> {
  type: "custom";
  key: string;
  label: string;
  className?: string;
  headerClassName?: string;
  render: (row: T) => ReactNode;
}

export type TableColumnConfig<T> =
  | DisplayCellConfig<T>
  | BadgeCellConfig<T>
  | CustomCellConfig<T>;
