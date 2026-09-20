import { useLocaleStore } from "../stores/locale";
import type { Locale } from "./locale";
import { en, type Messages } from "./messages";
import { es } from "./messages.es";

const catalogs: Record<Locale, Messages> = { en, es };

export type MessageParams = Record<string, string | number>;

/** Union of every message path, derived from the English catalog. */
export type MessageKey = Leaves<Messages>;

type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`;
}[keyof T & string];

function lookup(messages: Messages, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** Replaces `{name}` placeholders; missing values keep the placeholder. */
export function interpolate(template: string, params?: MessageParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/** Resolves a message for an explicit locale. */
export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  const template = lookup(catalogs[locale], key) ?? lookup(en, key) ?? key;
  return interpolate(template, params ?? {});
}

/**
 * Translation bound to the active locale. It reads the store directly, so it
 * is safe to call from event handlers and stores, not only inside components.
 */
export function t(key: MessageKey, params?: MessageParams): string {
  return translate(useLocaleStore.getState().locale, key, params);
}

/** Hook for components: re-renders when the locale changes. */
export function useI18n(): {
  locale: Locale;
  t: (key: MessageKey, params?: MessageParams) => string;
} {
  const locale = useLocaleStore((state) => state.locale);
  return {
    locale,
    t: (key, params) => translate(locale, key, params),
  };
}
