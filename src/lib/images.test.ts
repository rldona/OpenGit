import { describe, expect, it } from "vitest";
import { isImagePath } from "./images";

describe("isImagePath", () => {
  it("recognizes image extensions", () => {
    expect(isImagePath("assets/logo.PNG")).toBe(true);
    expect(isImagePath("foto.jpeg")).toBe(true);
    expect(isImagePath("anim.gif")).toBe(true);
    expect(isImagePath("x.webp")).toBe(true);
    expect(isImagePath("x.avif")).toBe(true);
    expect(isImagePath("x.heic")).toBe(true);
  });

  it("leaves out what is not an image", () => {
    expect(isImagePath("src/main.rs")).toBe(false);
    expect(isImagePath("icono.svg")).toBe(false);
    expect(isImagePath("datos.bin")).toBe(false);
    expect(isImagePath("logo.png.bak")).toBe(false);
  });
});
