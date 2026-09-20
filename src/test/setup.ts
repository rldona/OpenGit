import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(cleanup);

// jsdom no implementa canvas; el componente ya contempla getContext() === null.
HTMLCanvasElement.prototype.getContext = vi.fn(
  () => null,
) as unknown as typeof HTMLCanvasElement.prototype.getContext;

if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
