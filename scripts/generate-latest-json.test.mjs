import { describe, expect, it } from "vitest";
import { buildLatestJson, selectArtifacts } from "./generate-latest-json.mjs";

const BASE = "https://github.com/rldona/OpenGit/releases/download/v0.6.0";

const FILES = [
  "artifacts/opengit-macos/OpenGit.app.tar.gz",
  "artifacts/opengit-macos/OpenGit.app.tar.gz.sig",
  "artifacts/opengit-linux/OpenGit_0.6.0_amd64.AppImage",
  "artifacts/opengit-linux/OpenGit_0.6.0_amd64.AppImage.sig",
  "artifacts/opengit-windows/OpenGit_0.6.0_x64-setup.exe",
  "artifacts/opengit-windows/OpenGit_0.6.0_x64-setup.exe.sig",
];

const readSignature = (path) => `sig:${path}`;

describe("selectArtifacts", () => {
  it("maps each bundle to its platform with URL and signature", () => {
    const entries = selectArtifacts(FILES, BASE, readSignature);

    expect(entries).toEqual([
      {
        target: "darwin-aarch64",
        url: `${BASE}/OpenGit.app.tar.gz`,
        signature: "sig:artifacts/opengit-macos/OpenGit.app.tar.gz.sig",
      },
      {
        target: "linux-x86_64",
        url: `${BASE}/OpenGit_0.6.0_amd64.AppImage`,
        signature: "sig:artifacts/opengit-linux/OpenGit_0.6.0_amd64.AppImage.sig",
      },
      {
        target: "windows-x86_64",
        url: `${BASE}/OpenGit_0.6.0_x64-setup.exe`,
        signature: "sig:artifacts/opengit-windows/OpenGit_0.6.0_x64-setup.exe.sig",
      },
    ]);
  });

  it("ignores a missing platform but fails without any artifact", () => {
    const macOnly = FILES.filter((file) => file.includes("macos"));
    expect(selectArtifacts(macOnly, BASE, readSignature)).toHaveLength(1);
    expect(() => selectArtifacts([], BASE, readSignature)).toThrow(/no updater artifacts/);
  });

  it("fails when a bundle has no signature", () => {
    const unsigned = FILES.filter((file) => !file.endsWith(".sig"));
    expect(() => selectArtifacts(unsigned, BASE, readSignature)).toThrow(/missing signature/);
  });

  it("normalizes a trailing slash in the base URL", () => {
    const [entry] = selectArtifacts(["OpenGit.app.tar.gz", "OpenGit.app.tar.gz.sig"], `${BASE}/`, readSignature);
    expect(entry.url).toBe(`${BASE}/OpenGit.app.tar.gz`);
  });
});

describe("buildLatestJson", () => {
  it("builds the manifest with version, date and platform map", () => {
    const manifest = buildLatestJson(
      [{ target: "darwin-aarch64", url: `${BASE}/OpenGit.app.tar.gz`, signature: "abc" }],
      { version: "0.6.0", notes: "Fixes", pubDate: "2026-09-20T00:00:00.000Z" },
    );

    expect(manifest).toEqual({
      version: "0.6.0",
      notes: "Fixes",
      pub_date: "2026-09-20T00:00:00.000Z",
      platforms: { "darwin-aarch64": { signature: "abc", url: `${BASE}/OpenGit.app.tar.gz` } },
    });
  });

  it("omits empty notes", () => {
    const manifest = buildLatestJson([{ target: "linux-x86_64", url: "u", signature: "s" }], {
      version: "0.6.0",
      pubDate: "now",
    });
    expect(manifest).not.toHaveProperty("notes");
  });
});
