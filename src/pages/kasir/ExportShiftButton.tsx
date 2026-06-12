import { useState } from "react";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../../core/components/ui/Button";
import { useLanguage } from "../../core/context/LanguageContext";
import { exportShiftToCsv } from "./exportShiftCsv";

interface ExportShiftButtonProps {
  sessionToken: string;
  shiftId: Id<"shifts">;
}

export function ExportShiftButton({
  sessionToken,
  shiftId,
}: ExportShiftButtonProps) {
  const { translate } = useLanguage();
  const convex = useConvex();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const data = await convex.query(api.shifts.getShiftExportData, {
        sessionToken,
        shiftId,
      });
      exportShiftToCsv(shiftId, data.summary, data.lines);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleExport} loading={loading}>
      {translate("kasirExportCsv")}
    </Button>
  );
}
