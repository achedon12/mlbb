import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { afterLoad, whenIdle } from "@/lib/idle";

/**
 * Deferred work (mascot drawings, service worker, popups) waits for the
 * page's load, then for an idle main thread, and can always be cancelled.
 */
type Listener = () => void;

function fakeBrowser({ readyState, idle }: { readyState: DocumentReadyState; idle: boolean }) {
  const listeners = new Map<string, Listener>();
  const idleQueue = new Map<number, Listener>();
  let nextId = 1;
  const win = {
    addEventListener: vi.fn((type: string, fn: Listener) => listeners.set(type, fn)),
    removeEventListener: vi.fn((type: string) => listeners.delete(type)),
    ...(idle
      ? {
          requestIdleCallback: vi.fn((fn: Listener) => {
            const id = nextId++;
            idleQueue.set(id, fn);
            return id;
          }),
          cancelIdleCallback: vi.fn((id: number) => idleQueue.delete(id)),
        }
      : {}),
  };
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", { readyState });
  return {
    fireLoad: () => listeners.get("load")?.(),
    runIdle: () => {
      const queued = [...idleQueue.values()];
      idleQueue.clear();
      queued.forEach((fn) => fn());
    },
    hasLoadListener: () => listeners.has("load"),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("whenIdle", () => {
  it("runs on the idle callback when the browser has one", () => {
    const browser = fakeBrowser({ readyState: "complete", idle: true });
    const run = vi.fn();
    whenIdle(run);
    expect(run).not.toHaveBeenCalled();
    browser.runIdle();
    expect(run).toHaveBeenCalledOnce();
  });

  it("falls back to a short delay without one, and can be cancelled", () => {
    fakeBrowser({ readyState: "complete", idle: false });
    const run = vi.fn();
    const cancel = whenIdle(run);
    cancel();
    vi.advanceTimersByTime(1000);
    expect(run).not.toHaveBeenCalled();

    whenIdle(run);
    vi.advanceTimersByTime(200);
    expect(run).toHaveBeenCalledOnce();
  });
});

describe("afterLoad", () => {
  it("waits for the load event, then for idle time", () => {
    const browser = fakeBrowser({ readyState: "interactive", idle: true });
    const run = vi.fn();
    afterLoad(run);
    browser.runIdle();
    expect(run).not.toHaveBeenCalled();
    browser.fireLoad();
    expect(run).not.toHaveBeenCalled();
    browser.runIdle();
    expect(run).toHaveBeenCalledOnce();
  });

  it("only waits for idle time when the page has already loaded", () => {
    const browser = fakeBrowser({ readyState: "complete", idle: true });
    const run = vi.fn();
    afterLoad(run);
    expect(browser.hasLoadListener()).toBe(false);
    browser.runIdle();
    expect(run).toHaveBeenCalledOnce();
  });

  it("never runs once cancelled, before or after the load", () => {
    const before = fakeBrowser({ readyState: "loading", idle: true });
    const run = vi.fn();
    afterLoad(run)();
    expect(before.hasLoadListener()).toBe(false);

    const after = fakeBrowser({ readyState: "loading", idle: true });
    const cancel = afterLoad(run);
    after.fireLoad();
    cancel();
    after.runIdle();
    expect(run).not.toHaveBeenCalled();
  });
});
