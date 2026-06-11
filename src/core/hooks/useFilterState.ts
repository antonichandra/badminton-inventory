import { useCallback, useMemo, useState } from "react";
import type { FilterFieldConfig, FilterValues } from "../components/filters/types";

function buildDefaultValues(fields: FilterFieldConfig[]): FilterValues {
  return fields.reduce<FilterValues>((acc, field) => {
    if (field.type === "multi-dropdown") {
      acc[field.key] = [];
    } else {
      acc[field.key] = "";
    }
    return acc;
  }, {});
}

export function useFilterState(fields: FilterFieldConfig[]) {
  const defaultValues = useMemo(() => buildDefaultValues(fields), [fields]);
  const [draftValues, setDraftValues] = useState<FilterValues>(defaultValues);
  const [appliedValues, setAppliedValues] = useState<FilterValues>(defaultValues);

  const applyFilters = useCallback(() => {
    setAppliedValues({ ...draftValues });
  }, [draftValues]);

  const resetFilters = useCallback(() => {
    setDraftValues(defaultValues);
    setAppliedValues(defaultValues);
  }, [defaultValues]);

  return {
    draftValues,
    appliedValues,
    setDraftValues,
    applyFilters,
    resetFilters,
  };
}
