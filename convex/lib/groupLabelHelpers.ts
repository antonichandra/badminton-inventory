export function normalizeGroupKey(label: string): string {
  return label.trim().toLowerCase();
}

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
