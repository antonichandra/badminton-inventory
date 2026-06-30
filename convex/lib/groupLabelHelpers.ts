export function normalizeGroupKey(label: string): string {
  return label.trim().toLowerCase();
}

/** Virtual analytics/kasir bucket for paid lines without groupLabel. */
export const UNGROUPED_GROUP_KEY = "__ungrouped__";

/** Virtual analytics bucket for retail miss input at shift close. */
export const MISS_INPUT_GROUP_KEY = "__miss_input__";

export function formatGroupLabel(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
}

export function parseGroupLabel(
  label: string | undefined,
): string | undefined {
  const trimmed = label?.trim();
  if (!trimmed) return undefined;
  return formatGroupLabel(trimmed);
}
