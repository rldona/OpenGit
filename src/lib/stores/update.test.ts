import { beforeEach, describe, expect, it, vi } from "vitest";
import { appVersion } from "../bridge/app";
import { useUpdateStore } from "./update";

vi.mock("../bridge/app", () => ({
  appVersion: vi.fn(),
}));

const LATEST = "https://api.github.com/repos/rldona/OpenGit/releases/latest";

function jsonResponse(tag: string): Response {
  return new Response(JSON.stringify({ tag_name: tag }), { status: 200 });
}

describe("useUpdateStore", () => {
  beforeEach(() => {
    useUpdateStore.getState().reset();
    localStorage.clear();
    vi.mocked(appVersion).mockResolvedValue("0.3.1");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("surfaces a newer release", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse("v0.4.0"));

    await useUpdateStore.getState().check();

    expect(useUpdateStore.getState().status).toBe("available");
    expect(useUpdateStore.getState().version).toBe("v0.4.0");
  });

  it("stays silent when up to date on automatic checks", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse("v0.3.1"));

    await useUpdateStore.getState().check();

    expect(useUpdateStore.getState().status).toBe("idle");
    expect(useUpdateStore.getState().version).toBeNull();
  });

  it("reports up-to-date on manual checks", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse("v0.3.1"));

    await useUpdateStore.getState().check({ manual: true });

    expect(useUpdateStore.getState().status).toBe("up-to-date");
  });

  it("stays silent offline on automatic checks, errors on manual ones", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("offline"));

    await useUpdateStore.getState().check();
    expect(useUpdateStore.getState().status).toBe("idle");

    await useUpdateStore.getState().check({ manual: true });
    expect(useUpdateStore.getState().status).toBe("error");
    expect(useUpdateStore.getState().detail).toContain("offline");
  });

  it("skips automatic checks within 24h but never manual ones", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(jsonResponse("v0.4.0"));

    await useUpdateStore.getState().check();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await useUpdateStore.getState().check();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await useUpdateStore.getState().check({ manual: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(LATEST, expect.anything());
  });
});
