import type { ReactNode } from "react";
import { AdaptiveOverlay } from "./AdaptiveOverlay";

type ModalSize = "sm" | "md" | "lg";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
}

export function Modal(props: ModalProps) {
  return <AdaptiveOverlay {...props} />;
}
