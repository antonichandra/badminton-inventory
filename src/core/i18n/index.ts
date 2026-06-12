import type { LanguagePreference } from "../../types/auth";
import { app } from "./translations/app";
import { auth } from "./translations/auth";
import { common } from "./translations/common";
import { dashboard } from "./translations/dashboard";
import { business } from "./translations/business";
import { master } from "./translations/master";
import { nav } from "./translations/nav";
import { sports } from "./translations/sports";
import { inventory } from "./translations/inventory";

const id = {
  ...app.ID,
  ...auth.ID,
  ...nav.ID,
  ...dashboard.ID,
  ...master.ID,
  ...business.ID,
  ...common.ID,
  ...sports.ID,
  ...inventory.ID,
} as const;

const en = {
  ...app.EN,
  ...auth.EN,
  ...nav.EN,
  ...dashboard.EN,
  ...master.EN,
  ...business.EN,
  ...common.EN,
  ...sports.EN,
  ...inventory.EN,
} as const;

export const translations = {
  ID: id,
  EN: en,
} as const;

export type TranslationKey = keyof typeof id;

export function t(language: LanguagePreference, key: TranslationKey): string {
  return translations[language][key];
}

export function getTranslations(language: LanguagePreference) {
  return translations[language];
}
