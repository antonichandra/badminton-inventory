import type { TranslationKey } from "./index";

export type SportSlug = "badminton" | "futsal" | "basket" | "tenis" | "voli";

const SPORT_KEYS: Record<SportSlug, TranslationKey> = {
  badminton: "sportBadminton",
  futsal: "sportFutsal",
  basket: "sportBasket",
  tenis: "sportTenis",
  voli: "sportVoli",
};

export function translateSportName(
  translate: (key: TranslationKey) => string,
  slug: string,
  fallbackName?: string,
): string {
  const key = SPORT_KEYS[slug as SportSlug];
  if (key) {
    return translate(key);
  }
  return fallbackName ?? slug;
}

export function mapSportSelectOptions<
  T extends { label: string; sportSlug?: string },
>(options: T[], translate: (key: TranslationKey) => string): T[] {
  return options.map((option) => ({
    ...option,
    label: option.sportSlug
      ? translateSportName(translate, option.sportSlug, option.label)
      : option.label,
  }));
}
