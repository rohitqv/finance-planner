import "@testing-library/jest-dom/vitest";

// Recharts' ResponsiveContainer measures its container via ResizeObserver
// plus an initial getBoundingClientRect() call. jsdom has no layout engine
// and no ResizeObserver, so without this shim any chart wrapped in
// ResponsiveContainer measures 0x0 and renders no children at all (not even
// an <svg>) in tests.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => ({
    width: 500,
    height: 300,
    top: 0,
    left: 0,
    bottom: 300,
    right: 500,
    x: 0,
    y: 0,
    toJSON() {},
  }),
});
