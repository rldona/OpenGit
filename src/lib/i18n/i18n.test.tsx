import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useLocaleStore } from "../stores/locale";
import { t, translate, useI18n } from "./index";
import { es } from "./messages.es";
import { en } from "./messages";

function flatten(object: Record<string, unknown>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      result[path] = value;
    } else if (value !== null && typeof value === "object") {
      Object.assign(result, flatten(value as Record<string, unknown>, path));
    }
  }
  return result;
}

function Sample() {
  const { t: translateMessage } = useI18n();
  return <p>{translateMessage("welcome.title")}</p>;
}

describe("i18n", () => {
  beforeEach(() => {
    useLocaleStore.setState({ preference: null, locale: "en" });
  });

  it("has the same keys in English and Spanish", () => {
    expect(Object.keys(flatten(es)).sort()).toEqual(Object.keys(flatten(en)).sort());
  });

  it("interpolates the placeholders", () => {
    expect(translate("en", "tabs.close", { name: "repo" })).toBe("Close repo");
    expect(translate("es", "tabs.close", { name: "repo" })).toBe("Cerrar repo");
    expect(translate("en", "welcome.title")).toBe("No repository open");
  });

  it("t reads the active locale", () => {
    expect(t("welcome.title")).toBe("No repository open");
    useLocaleStore.setState({ preference: "es", locale: "es" });
    expect(t("welcome.title")).toBe("Ningún repositorio abierto");
  });

  it("renders the English catalog", () => {
    render(<Sample />);
    expect(screen.getByText(en.welcome.title)).toBeInTheDocument();
  });

  it("renders the Spanish catalog", () => {
    useLocaleStore.setState({ preference: "es", locale: "es" });
    render(<Sample />);
    expect(screen.getByText(es.welcome.title)).toBeInTheDocument();
  });

  it("re-renders a component when the locale changes", () => {
    render(<Sample />);
    expect(screen.getByText(en.welcome.title)).toBeInTheDocument();

    act(() => {
      useLocaleStore.getState().setPreference("es");
    });

    expect(screen.getByText(es.welcome.title)).toBeInTheDocument();
  });
});
