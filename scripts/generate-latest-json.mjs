#!/usr/bin/env node
// Builds the Tauri updater manifest (OG-081, ADR-0007) from the signed
// release artifacts. Uploaded as `latest.json` next to the installers, it is
// what `releases/latest/download/latest.json` serves to the app.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

/**
 * Updater platform -> artifact file-name suffix, in the same OS-ARCH keys the
 * updater plugin looks up. macOS publishes the runner architecture only.
 */
export const PLATFORMS = [
  { target: "darwin-aarch64", suffix: ".app.tar.gz" },
  { target: "linux-x86_64", suffix: ".AppImage" },
  { target: "windows-x86_64", suffix: "-setup.exe" },
];

/** Recursively lists every file under `dir`. */
export function walkFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walkFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

/**
 * Pairs each platform bundle with its `.sig` sibling. `readSignature` is
 * injectable so the mapping can be tested without touching disk.
 */
export function selectArtifacts(
  files,
  baseUrl,
  readSignature = (path) => readFileSync(path, "utf8"),
) {
  const base = baseUrl.replace(/\/+$/, "");
  const entries = [];
  for (const { target, suffix } of PLATFORMS) {
    const bundle = files.find((file) => file.endsWith(suffix));
    if (bundle === undefined) {
      continue;
    }
    if (!files.includes(`${bundle}.sig`)) {
      throw new Error(`missing signature for ${bundle}`);
    }
    entries.push({
      target,
      url: `${base}/${basename(bundle)}`,
      signature: readSignature(`${bundle}.sig`).trim(),
    });
  }
  if (entries.length === 0) {
    throw new Error("no updater artifacts found");
  }
  return entries;
}

/** Assembles the static updater manifest. */
export function buildLatestJson(entries, { version, notes, pubDate }) {
  const platforms = {};
  for (const { target, url, signature } of entries) {
    platforms[target] = { signature, url };
  }
  return {
    version,
    ...(notes ? { notes } : {}),
    pub_date: pubDate,
    platforms,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    args[argv[index].replace(/^--/, "")] = argv[index + 1];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const artifacts = args.artifacts;
  const repo = args.repo ?? process.env.GITHUB_REPOSITORY;
  const tag = args.tag ?? process.env.GITHUB_REF_NAME;
  const out = args.out ?? "latest.json";

  if (!artifacts || !repo || !tag) {
    console.error("usage: generate-latest-json.mjs --artifacts DIR --repo OWNER/NAME --tag vX.Y.Z [--out FILE] [--notes TEXT] [--pub-date ISO8601]");
    process.exit(1);
  }

  const version = tag.replace(/^v/, "");
  const baseUrl = `https://github.com/${repo}/releases/download/${tag}`;
  const entries = selectArtifacts(walkFiles(artifacts), baseUrl);
  const manifest = buildLatestJson(entries, {
    version,
    notes: args.notes,
    pubDate: args["pub-date"] ?? new Date().toISOString(),
  });
  writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${out} for ${version} (${entries.map((e) => e.target).join(", ")})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
