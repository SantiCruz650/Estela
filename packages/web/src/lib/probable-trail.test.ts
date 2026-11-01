import { beforeEach, describe, expect, it } from "vitest";
import { parseLine, type LogLine, type RequestRecord } from "@devtool/core";
import { markArrival } from "./line-arrival";
import { isSecureLineFor, probableLineIds } from "./probable-trail";

function request(requestId: string, startedAt: number, durationMs: number | null): RequestRecord {
  return { requestId, method: "GET", url: "http://localhost/api", statusCode: 200, startedAt, durationMs };
}

const reqA = "req-a";
const reqB = "req-b";
const BASE = Date.parse("2026-01-01T00:00:01.000Z");

beforeEach(() => {});

describe("isSecureLineFor", () => {
  it("segura por requestIds parseados o por raw con el id exacto", () => {
    const parsed = parseLine(`INFO hola ${reqA}`, "app.log") as LogLine;
    expect(isSecureLineFor(parsed, reqA)).toBe(true);
    expect(isSecureLineFor(parseLine("INFO chau", "app.log"), reqA)).toBe(false);
  });
});

describe("probableLineIds", () => {
  it("asigna probables y nunca a líneas seguras", () => {
    // req-a: ventana [BASE, BASE + 100 + 50]; línea con timestamp BASE + 50 sin id → probable.
    const requests = [
      request(reqA, BASE, 100),
      request(reqB, BASE + 60_000, 100),
    ];
    const probable = parseLine(`[${new Date(BASE + 50).toISOString()}] INFO creando usuario`, "app.log");
    const secure = parseLine(`[${new Date(BASE + 60).toISOString()}] INFO POST id=${reqA} listo`, "app.log");
    markArrival([probable, secure]);

    const ids = probableLineIds([probable, secure], requests, reqA);
    expect(ids.has(probable.id)).toBe(true);
    expect(ids.has(secure.id)).toBe(false);
  });

  it("excluye probables de otro request", () => {
    const requests = [
      request(reqA, BASE, 100),
      request(reqB, BASE + 60_000, 100),
    ];
    const probableB = parseLine(`[${new Date(BASE + 60_050).toISOString()}] INFO del otro`, "app.log");
    markArrival([probableB]);
    const ids = probableLineIds([probableB], requests, reqA);
    expect(ids.size).toBe(0);
  });

  it("sin timestamp usa la hora de llegada con ventana amplia (+400 ms)", () => {
    const requests = [request(reqA, BASE, 100)];
    const line = parseLine("INFO sin timestamp", "app.log");
    // Sin marca previa → arrival 0, mucho antes del request → no probable.
    expect(probableLineIds([line], requests, reqA).size).toBe(0);
    markArrival([line]);
    // La marca real es Date.now(): muy después de la ventana del test → no probable.
    expect(probableLineIds([line], requests, reqA).size).toBe(0);
  });
});
