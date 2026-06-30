/** Matches convex/lib/groupLabelHelpers.ts */
export const UNGROUPED_GROUP_KEY = "__ungrouped__";
export const MISS_INPUT_GROUP_KEY = "__miss_input__";

export function resolveSpendingGroupLabel(
  groupLabel: string,
  labels: { ungrouped: string; missInput: string },
): string {
  if (groupLabel === UNGROUPED_GROUP_KEY) return labels.ungrouped;
  if (groupLabel === MISS_INPUT_GROUP_KEY) return labels.missInput;
  return groupLabel;
}
