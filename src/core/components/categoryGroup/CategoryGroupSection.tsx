import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../utils/cn";
import {
  categoryGroupBadgeClass,
  categoryGroupBodyClass,
  categoryGroupHeaderButtonClass,
  categoryGroupHeaderClass,
  categoryGroupMetaClass,
  categoryGroupSectionClass,
  categoryGroupTitleClass,
  categoryGroupTitleWrapClass,
} from "./styles";

interface CategoryGroupSectionProps {
  categoryName: string;
  itemCount?: number;
  itemCountLabel?: string;
  meta?: ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  className?: string;
  children: ReactNode;
}

export function CategoryGroupSection({
  categoryName,
  itemCount,
  itemCountLabel,
  meta,
  collapsible = false,
  defaultExpanded = true,
  className,
  children,
}: CategoryGroupSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const headerContent = (
    <>
      <div className={categoryGroupTitleWrapClass}>
        <span className={categoryGroupTitleClass}>{categoryName}</span>
        {itemCountLabel != null && (
          <span className={categoryGroupBadgeClass}>{itemCountLabel}</span>
        )}
        {itemCount != null && itemCountLabel == null && (
          <span className={categoryGroupBadgeClass}>{itemCount}</span>
        )}
      </div>
      {meta != null && (
        <span className={cn(categoryGroupMetaClass, "hidden sm:inline")}>
          {meta}
        </span>
      )}
      {collapsible && (
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform",
            expanded && "rotate-180",
          )}
        />
      )}
    </>
  );

  return (
    <section className={cn(categoryGroupSectionClass, className)}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={categoryGroupHeaderButtonClass}
          aria-expanded={expanded}
        >
          {headerContent}
        </button>
      ) : (
        <div className={categoryGroupHeaderClass}>{headerContent}</div>
      )}
      {meta != null && (
        <div className="border-b border-slate-100 px-2.5 py-1 sm:hidden dark:border-slate-800">
          <span className={categoryGroupMetaClass}>{meta}</span>
        </div>
      )}
      {(!collapsible || expanded) && (
        <div className={categoryGroupBodyClass}>{children}</div>
      )}
    </section>
  );
}
