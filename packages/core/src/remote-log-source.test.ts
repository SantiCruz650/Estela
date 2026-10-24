import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RemoteLogSource } from "./remote-log-source.js";

type TailPayload = { size: number; truncated: boolean; data: string };

function fakeFetchQueue(queue: Array<TailPayload | Error | "invalid">, urls: string[]) {
  return vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    urls.push(String(input));
    const next = queue.shift();
    if (next instanceof Error) {
      throw next;
    }
    return {
      json: async () => (next === "invalid" ? { nope: true } : next),
    } as Response;
  });
}

describe("RemoteLogSource", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not emit preexisting data on the first end tick", async () => {
    const urls: string[] = [];
    const fetchImpl = fakeFetchQueue([{ size: 12, truncated: false, data: "INFO old\n" }], urls);
    const source = new RemoteLogSource((offset) => `https://api.test/logs?offset=${offset}`, { fetchImpl });
    const received: string[] = [];
    source.subscribe((lines) => received.push(...lines.map((line) => line.raw)));
    await source.start();
    await vi.advanceTimersByTimeAsync(300);
    expect(received).toEqual([]);
    expect(urls).toEqual(["https://api.test/logs?offset=0"]);
    await source.stop();
  });

  it("emits data on the first start tick", async () => {
    const fetchImpl = fakeFetchQueue([{ size: 10, truncated: false, data: "INFO ready\n" }], []);
    const source = new RemoteLogSource(() => "https://api.test/logs", { fetchImpl, readFrom: "start" });
    const received: string[] = [];
    source.subscribe((lines) => received.push(...lines.map((line) => line.raw)));
    await source.start();
    await vi.advanceTimersByTimeAsync(300);
    expect(received).toEqual(["INFO ready"]);
    await source.stop();
  });

  it("emits a later delta and requests the response size", async () => {
    const urls: string[] = [];
    const fetchImpl = fakeFetchQueue([
      { size: 5, truncated: false, data: "" },
      { size: 16, truncated: false, data: "INFO new\n" },
    ], urls);
    const source = new RemoteLogSource((offset) => `https://api.test/logs?offset=${offset}`, { fetchImpl });
    const received: string[] = [];
    source.subscribe((lines) => received.push(...lines.map((line) => line.raw)));
    await source.start();
    await vi.advanceTimersByTimeAsync(600);
    expect(received).toEqual(["INFO new"]);
    expect(urls).toEqual(["https://api.test/logs?offset=0", "https://api.test/logs?offset=5"]);
    await source.stop();
  });

  it("completes a remainder across ticks", async () => {
    const fetchImpl = fakeFetchQueue([
      { size: 5, truncated: false, data: "INFO " },
      { size: 16, truncated: false, data: "ready\n" },
    ], []);
    const source = new RemoteLogSource(() => "https://api.test/logs", { fetchImpl, readFrom: "start" });
    const received: string[] = [];
    source.subscribe((lines) => received.push(...lines.map((line) => line.raw)));
    await source.start();
    await vi.advanceTimersByTimeAsync(600);
    expect(received).toEqual(["INFO ready"]);
    await source.stop();
  });

  it("re-emits data when the server reports truncation", async () => {
    const fetchImpl = fakeFetchQueue([
      { size: 5, truncated: false, data: "INFO old\n" },
      { size: 6, truncated: true, data: "WARN new\n" },
    ], []);
    const source = new RemoteLogSource(() => "https://api.test/logs", { fetchImpl, readFrom: "start" });
    const received: string[] = [];
    source.subscribe((lines) => received.push(...lines.map((line) => line.raw)));
    await source.start();
    await vi.advanceTimersByTimeAsync(600);
    expect(received).toEqual(["INFO old", "WARN new"]);
    await source.stop();
  });

  it("continues polling after a network error", async () => {
    const fetchImpl = fakeFetchQueue([new Error("offline"), { size: 10, truncated: false, data: "INFO later\n" }], []);
    const source = new RemoteLogSource(() => "https://api.test/logs", { fetchImpl, readFrom: "start" });
    const received: string[] = [];
    source.subscribe((lines) => received.push(...lines.map((line) => line.raw)));
    await source.start();
    await vi.advanceTimersByTimeAsync(600);
    expect(received).toEqual(["INFO later"]);
    await source.stop();
  });

  it("does not emit an in-flight response after stop", async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchImpl = vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    const source = new RemoteLogSource(() => "https://api.test/logs", { fetchImpl, readFrom: "start" });
    const received: string[] = [];
    source.subscribe((lines) => received.push(...lines.map((line) => line.raw)));

    await source.start();
    const tick = vi.advanceTimersByTimeAsync(300);
    await Promise.resolve();
    await source.stop();
    resolveFetch?.({
      json: async () => ({ size: 10, truncated: false, data: "INFO late\n" }),
    } as Response);
    await tick;

    expect(received).toEqual([]);
  });

  it("reports three failures and continues until data recovers", async () => {
    const errors: unknown[] = [];
    const fetchImpl = fakeFetchQueue([
      new Error("offline 1"),
      new Error("offline 2"),
      new Error("offline 3"),
      { size: 11, truncated: false, data: "INFO recovered\n" },
    ], []);
    const source = new RemoteLogSource(() => "https://api.test/logs", {
      fetchImpl,
      readFrom: "start",
      onError: (error) => errors.push(error),
    });
    const received: string[] = [];
    source.subscribe((lines) => received.push(...lines.map((line) => line.raw)));

    await source.start();
    await vi.advanceTimersByTimeAsync(1200);

    expect(errors).toHaveLength(3);
    expect(received).toEqual(["INFO recovered"]);
    await source.stop();
  });

  it("continues polling after invalid JSON", async () => {
    const fetchImpl = fakeFetchQueue(["invalid", { size: 10, truncated: false, data: "INFO later\n" }], []);
    const source = new RemoteLogSource(() => "https://api.test/logs", { fetchImpl, readFrom: "start" });
    const received: string[] = [];
    source.subscribe((lines) => received.push(...lines.map((line) => line.raw)));
    await source.start();
    await vi.advanceTimersByTimeAsync(600);
    expect(received).toEqual(["INFO later"]);
    await source.stop();
  });

  it("stops polling and unsubscribes", async () => {
    const urls: string[] = [];
    const fetchImpl = fakeFetchQueue([{ size: 10, truncated: false, data: "INFO one\n" }, { size: 20, truncated: false, data: "INFO two\n" }], urls);
    const source = new RemoteLogSource((offset) => `https://api.test/logs?offset=${offset}`, { fetchImpl, readFrom: "start" });
    const received: string[] = [];
    source.subscribe((lines) => received.push(...lines.map((line) => line.raw)));
    await source.start();
    await vi.advanceTimersByTimeAsync(300);
    await source.stop();
    await vi.advanceTimersByTimeAsync(600);
    expect(received).toEqual(["INFO one"]);
    expect(urls).toHaveLength(1);
  });

  it("resets on rotation and delivers only new lines without mixing old buffer", async () => {
    const fetchImpl = fakeFetchQueue([
      { size: 100, truncated: false, data: "INFO old-partial " },
      { size: 40, truncated: true, data: "WARN new\n" },
    ], []);
    const source = new RemoteLogSource(() => "https://api.test/logs", { fetchImpl, readFrom: "start" });
    const received: string[] = [];
    source.subscribe((lines) => received.push(...lines.map((line) => line.raw)));
    await source.start();
    await vi.advanceTimersByTimeAsync(600);
    expect(received).toEqual(["WARN new"]);
    await source.stop();
  });

  it("sends the configured headers on every poll", async () => {
    const seenHeaders: Array<Record<string, string> | undefined> = [];
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const headers = init?.headers as Record<string, string> | undefined;
      seenHeaders.push(headers);
      return { json: async () => ({ size: 10, truncated: false, data: "INFO hola\n" }) } as Response;
    }) as unknown as typeof fetch;
    const source = new RemoteLogSource(() => "https://api.test/logs", {
      fetchImpl,
      readFrom: "start",
      headers: { "X-Estela-Token": "abc123" },
    });
    const received: string[] = [];
    source.subscribe((lines) => received.push(...lines.map((line) => line.raw)));
    await source.start();
    await vi.advanceTimersByTimeAsync(300);

    expect(received).toEqual(["INFO hola"]);
    expect(seenHeaders).toHaveLength(1);
    expect(seenHeaders[0]).toEqual({ "X-Estela-Token": "abc123" });
    await source.stop();
  });
});