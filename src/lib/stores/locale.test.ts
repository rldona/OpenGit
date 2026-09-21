import { beforeEach, describe, expect, it } from "vitest";
import { LOCALE_STORAGE_KEY } from "../i18n/locale";
import { useLocaleStore } from "./locale";

describe("useLocaleStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useLocaleStore.setState({ preference: null, locale: "en" });
  });

  it("stores the preference and applies it", () => {
    useLocaleStore.getState().setPreference("es");

    expect(useLocaleStore.getState().preference).toBe("es");
    expect(useLocaleStore.getState().locale).toBe("es");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("es");
  });

  it("follows the system locale when the preference is cleared", () => {
    useLocaleStore.getState().setPreference("es");
    useLocaleStore.getState().setPreference(null);

    expect(useLocaleStore.getState().preference).toBeNull();
    expect(useLocaleStore.getState().locale).toBe("en");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
  });
});
