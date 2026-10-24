import { describe, expect, it } from "vitest";
import type { HttpRequestInput } from "@devtool/core";
import { toCurl } from "./curl";

function makeInput(headers: Record<string, string>, body?: string): HttpRequestInput {
  return {
    method: "POST",
    url: "http://localhost:3000/api/orders",
    headers,
    body,
    requestId: "8f3a1111-2222-4333-8444-555566667777",
  };
}

describe("toCurl", () => {
  it("escribe el método y la URL", () => {
    const curl = toCurl(makeInput({}));
    expect(curl).toContain("curl -X POST");
    expect(curl.endsWith("'http://localhost:3000/api/orders'")).toBe(true);
  });

  it("redacta headers sensibles como [redacted]", () => {
    const curl = toCurl(makeInput({ Authorization: "Bearer sekret", "X-Trace": "abc" }));
    expect(curl).toContain("Authorization: [redacted]");
    expect(curl).not.toContain("sekret");
    expect(curl).toContain("X-Trace: abc");
  });

  it("incluye el body con --data", () => {
    const curl = toCurl(makeInput({}, '{"total":42.5}'));
    expect(curl).toContain("--data '{\"total\":42.5}'");
  });

  it("GET/HEAD no llevan -X", () => {
    const input = makeInput({});
    const curl = toCurl({ ...input, method: "GET" });
    expect(curl).not.toContain("-X");
  });
});
