import { describe, expect, it } from "vitest";
import { parseTrack } from "./format";

describe("parseTrack", () => {
  it("lee ahead y behind del track de git", () => {
    expect(parseTrack("[ahead 1, behind 2]")).toEqual({ ahead: 1, behind: 2 });
    expect(parseTrack("[ahead 3]")).toEqual({ ahead: 3, behind: 0 });
    expect(parseTrack("[behind 4]")).toEqual({ ahead: 0, behind: 4 });
  });

  it("ignora estados sin contadores", () => {
    expect(parseTrack("[gone]")).toBeNull();
    expect(parseTrack("")).toBeNull();
    expect(parseTrack(null)).toBeNull();
  });
});
