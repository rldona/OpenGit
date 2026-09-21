import { create } from "zustand";
import {
  loadLocalePreference,
  saveLocalePreference,
  systemLocale,
  type Locale,
} from "../i18n/locale";

const initialPreference = loadLocalePreference();

type LocaleState = {
  /** `null` means "follow the system" (OG-100). */
  preference: Locale | null;
  locale: Locale;
  setPreference: (preference: Locale | null) => void;
};

/** Active UI language (OG-099, ADR-0009). */
export const useLocaleStore = create<LocaleState>((set) => ({
  preference: initialPreference,
  locale: initialPreference ?? systemLocale(),
  setPreference: (preference) => {
    saveLocalePreference(preference);
    set({ preference, locale: preference ?? systemLocale() });
  },
}));
