import type { ReactNode } from "react";

interface PageTopSectionProps {
  children: ReactNode;
}

export function PageTopSection({ children }: PageTopSectionProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      {children}
    </div>
  );
}
