export type AppLanguage = "ID" | "EN";

function localeFor(language: AppLanguage): string {
  return language === "ID" ? "id-ID" : "en-US";
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

export function formatDateOnly(ts: number, language: AppLanguage): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(ts));
}

export function formatDateTime(ts: number, language: AppLanguage): string {
  return `${formatDateOnly(ts, language)}, ${formatTime(ts)}`;
}
