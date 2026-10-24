import { describe, expect, it } from "vitest";
import { isTrustedBridgeEvent } from "./extension-bridge";

const PAGE_ORIGIN = "https://esteladev.netlify.app";

describe("isTrustedBridgeEvent", () => {
  it("acepta mismo origin y source === window", () => {
    const win = {};
    expect(isTrustedBridgeEvent(PAGE_ORIGIN, win, PAGE_ORIGIN, win)).toBe(true);
  });

  it("rechaza origen distinto (página maliciosa)", () => {
    const win = {};
    expect(isTrustedBridgeEvent("https://evil.com", win, PAGE_ORIGIN, win)).toBe(false);
  });

  it("rechaza source distinto a window (iframe/pop-up)", () => {
    const win = {};
    const otherFrame = {};
    expect(isTrustedBridgeEvent(PAGE_ORIGIN, otherFrame, PAGE_ORIGIN, win)).toBe(false);
  });

  it("rechaza origin vacío", () => {
    const win = {};
    expect(isTrustedBridgeEvent("", win, PAGE_ORIGIN, win)).toBe(false);
  });
});
