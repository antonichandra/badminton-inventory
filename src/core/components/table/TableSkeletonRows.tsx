import { cn } from "../../utils/cn";
import { Skeleton } from "../ui/Skeleton";

const CELL_WIDTHS = ["w-full", "w-4/5", "w-3/5", "w-2/3", "w-1/2", "w-3/4"];

interface TableSkeletonRowsProps {
  columnCount: number;
  rowCount?: number;
}

export function TableSkeletonRows({
  columnCount,
  rowCount = 6,
}: TableSkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columnCount }).map((_, columnIndex) => (
            <td key={columnIndex} className="px-4 py-3 align-middle">
              <Skeleton
                className={cn(
                  "h-4",
                  CELL_WIDTHS[(rowIndex + columnIndex) % CELL_WIDTHS.length],
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
