import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { categoryGroupsContainerClass } from "./styles";

interface CategoryGroupsContainerProps {
  children: ReactNode;
  className?: string;
}

export function CategoryGroupsContainer({
  children,
  className,
}: CategoryGroupsContainerProps) {
  return (
    <div className={cn(categoryGroupsContainerClass, className)}>{children}</div>
  );
}
