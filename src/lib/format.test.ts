import { describe, expect, it } from "vitest";
import { classifyRef, formatAuthor, formatCommitDate, parseTrack } from "./format";

describe("parseTrack", () => {
  it("reads ahead and behind from git's track", () => {
    expect(parseTrack("[ahead 1, behind 2]")).toEqual({ ahead: 1, behind: 2 });
    expect(parseTrack("[ahead 3]")).toEqual({ ahead: 3, behind: 0 });
    expect(parseTrack("[behind 4]")).toEqual({ ahead: 0, behind: 4 });
  });

  it("ignores states without counters", () => {
    expect(parseTrack("[gone]")).toBeNull();
    expect(parseTrack("")).toBeNull();
    expect(parseTrack(null)).toBeNull();
  });
});

describe("formatCommitDate", () => {
  // Fixed clock: without injecting "now" these tests would fail across midnight.
  const now = new Date(2026, 8, 18, 22, 30);
  const at = (date: Date) => Math.floor(date.getTime() / 1000);

  it("shows today's times as Today", () => {
    expect(formatCommitDate(at(new Date(2026, 8, 18, 9, 5)), now)).toBe("Today at 09:05");
  });

  it("shows yesterday as Yesterday even if only a few hours have passed", () => {
    // Yesterday at 23:50 is 2h40 away from "now", but it is a different calendar day.
    expect(formatCommitDate(at(new Date(2026, 8, 17, 23, 50)), now)).toBe("Yesterday at 23:50");
  });

  it("uses an absolute date from the day before yesterday", () => {
    const texto = formatCommitDate(at(new Date(2026, 8, 16, 10, 0)), now);

    expect(texto).not.toContain("Today");
    expect(texto).not.toContain("Yesterday");
    expect(texto).toContain("16");
  });

  it("includes the year when the commit is from another year", () => {
    expect(formatCommitDate(at(new Date(2024, 0, 3, 10, 0)), now)).toContain("2024");
  });
});

describe("formatAuthor", () => {
  it("joins name and email", () => {
    expect(formatAuthor("Raúl López", "rldona@users.noreply.github.com")).toBe(
      "Raúl López <rldona@users.noreply.github.com>",
    );
  });

  it("omits the angle brackets if there is no email", () => {
    expect(formatAuthor("Raúl López", "")).toBe("Raúl López");
  });
});

describe("classifyRef", () => {
  it("distinguishes HEAD, local branch, remote and tag", () => {
    expect(classifyRef("HEAD")).toEqual({ kind: "head", label: "HEAD" });
    expect(classifyRef("HEAD -> main")).toEqual({ kind: "head", label: "main" });
    expect(classifyRef("tag: v1.0.0")).toEqual({ kind: "tag", label: "v1.0.0" });
    expect(classifyRef("origin/main")).toEqual({ kind: "remote", label: "origin/main" });
    expect(classifyRef("feature")).toEqual({ kind: "branch", label: "feature" });
  });

  it("treats a branch with a slash as remote", () => {
    // Known limitation: `%D` does not mark the origin, so a local branch
    // named "feat/x" is classified as remote.
    expect(classifyRef("feat/x").kind).toBe("remote");
  });
});
