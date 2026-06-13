import type { ReactNode } from "react";
import { AdaptiveOverlay } from "./AdaptiveOverlay";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Reserve space at the bottom (e.g. sticky pay bar). */
  bottomInset?: string;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  bottomInset,
}: BottomSheetProps) {
  return (
    <AdaptiveOverlay
      open={open}
      onClose={onClose}
      title={title}
      footer={footer}
      bottomInset={bottomInset}
      size="lg"
    >
      {children}
    </AdaptiveOverlay>
  );
}
