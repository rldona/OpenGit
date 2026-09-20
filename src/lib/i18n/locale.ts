/** Locales the app can render (OG-099, ADR-0009). */
export type Locale = "en" | "es";

export const LOCALE_STORAGE_KEY = "opengit.locale";

const LOCALES: Locale[] = ["en", "es"];

export function availableLocales(): Locale[] {
  return LOCALES;
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as string[]).includes(value);
}

/** Locale matching the system language, falling back to English. */
export function systemLocale(): Locale {
  const language = typeof navigator === "undefined" ? "" : navigator.language;
  return language.toLowerCase().startsWith("es") ? "es" : "en";
}

/** Stored choice; `null` means "follow the system" (OG-100). */
export function loadLocalePreference(): Locale | null {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function saveLocalePreference(locale: Locale | null): void {
  try {
    if (locale === null) {
      localStorage.removeItem(LOCALE_STORAGE_KEY);
    } else {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  } catch {
    // Without storage the preference lives only in memory.
  }
}
