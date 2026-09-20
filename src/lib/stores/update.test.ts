import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdateStore } from "./update";

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn().mockResolvedValue(undefined),
}));

function makeUpdate(version: string) {
  const download = vi.fn(async (onEvent?: (event: unknown) => void) => {
    onEvent?.({ event: "Started", data: { contentLength: 100 } });
    onEvent?.({ event: "Progress", data: { chunkLength: 40 } });
    onEvent?.({ event: "Progress", data: { chunkLength: 60 } });
    onEvent?.({ event: "Finished" });
  });
  const install = vi.fn().mockResolvedValue(undefined);
  return { version, download, install };
}

describe("useUpdateStore", () => {
  beforeEach(() => {
    useUpdateStore.getState().reset();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("checks, downloads and is ready without surfacing transient states", async () => {
    const update = makeUpdate("0.4.0");
    vi.mocked(check).mockResolvedValue(update as never);

    await useUpdateStore.getState().check();

    expect(useUpdateStore.getState().status).toBe("ready");
    expect(useUpdateStore.getState().version).toBe("0.4.0");
    expect(update.download).toHaveBeenCalledOnce();
  });

  it("stays silent when up to date on automatic checks", async () => {
    vi.mocked(check).mockResolvedValue(null);

    await useUpdateStore.getState().check();

    expect(useUpdateStore.getState().status).toBe("idle");
  });

  it("reports up-to-date on manual checks", async () => {
    vi.mocked(check).mockResolvedValue(null);

    await useUpdateStore.getState().check({ manual: true });

    expect(useUpdateStore.getState().status).toBe("up-to-date");
  });

  it("stays silent offline on automatic checks, errors on manual ones", async () => {
    vi.mocked(check).mockRejectedValue(new Error("offline"));

    await useUpdateStore.getState().check();
    expect(useUpdateStore.getState().status).toBe("idle");

    await useUpdateStore.getState().check({ manual: true });
    expect(useUpdateStore.getState().status).toBe("error");
    expect(useUpdateStore.getState().detail).toContain("offline");
  });

  it("exposes download progress on manual checks", async () => {
    let report: ((event: unknown) => void) | undefined;
    let finish: (() => void) | undefined;
    const update = makeUpdate("0.4.0");
    update.download.mockImplementation((onEvent?: (event: unknown) => void) => {
      onEvent?.({ event: "Started", data: { contentLength: 100 } });
      report = onEvent;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    vi.mocked(check).mockResolvedValue(update as never);

    const promise = useUpdateStore.getState().check({ manual: true });
    await vi.waitFor(() => expect(report).toBeDefined());
    report?.({ event: "Progress", data: { chunkLength: 25 } });

    expect(useUpdateStore.getState().status).toBe("downloading");
    expect(useUpdateStore.getState().progress).toBeCloseTo(0.25);

    finish?.();
    await promise;
    expect(useUpdateStore.getState().status).toBe("ready");
  });

  it("reopens a downloaded update without checking again", async () => {
    const update = makeUpdate("0.4.0");
    vi.mocked(check).mockResolvedValue(update as never);
    await useUpdateStore.getState().check();

    useUpdateStore.getState().dismiss();
    vi.mocked(check).mockClear();

    await useUpdateStore.getState().check({ manual: true });

    expect(useUpdateStore.getState().status).toBe("ready");
    expect(check).not.toHaveBeenCalled();
  });

  it("installs and relaunches on restart", async () => {
    const update = makeUpdate("0.4.0");
    vi.mocked(check).mockResolvedValue(update as never);
    await useUpdateStore.getState().check();

    await useUpdateStore.getState().restart();

    expect(update.install).toHaveBeenCalledOnce();
    expect(relaunch).toHaveBeenCalledOnce();
  });

  it("reports install failures and does not relaunch", async () => {
    const update = makeUpdate("0.4.0");
    update.install.mockRejectedValue(new Error("permission denied"));
    vi.mocked(check).mockResolvedValue(update as never);
    await useUpdateStore.getState().check();

    await useUpdateStore.getState().restart();

    expect(useUpdateStore.getState().status).toBe("error");
    expect(useUpdateStore.getState().detail).toContain("permission denied");
    expect(relaunch).not.toHaveBeenCalled();
  });

  it("skips automatic checks within 24h but never manual ones", async () => {
    vi.mocked(check).mockResolvedValue(null);

    await useUpdateStore.getState().check();
    expect(check).toHaveBeenCalledTimes(1);

    await useUpdateStore.getState().check();
    expect(check).toHaveBeenCalledTimes(1);

    await useUpdateStore.getState().check({ manual: true });
    expect(check).toHaveBeenCalledTimes(2);
  });
});
