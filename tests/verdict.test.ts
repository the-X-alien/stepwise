import { describe, expect, it } from "vitest";

import {
  extractJsonObject,
  normalizeVerdict,
  normalizeWarnings,
} from "@/lib/verdict";

describe("extractJsonObject", () => {
  it("parses a bare JSON object", () => {
    expect(extractJsonObject('{"status":"pass"}')).toEqual({ status: "pass" });
  });

  it("parses JSON wrapped in markdown fences", () => {
    expect(
      extractJsonObject('```json\n{"status":"not_yet"}\n```'),
    ).toEqual({ status: "not_yet" });
  });

  it("recovers JSON embedded in prose", () => {
    expect(
      extractJsonObject('Here is my answer: {"status":"unclear"} — hope that helps'),
    ).toEqual({ status: "unclear" });
  });

  it("returns null for unusable output", () => {
    expect(extractJsonObject("no json here")).toBeNull();
    expect(extractJsonObject("")).toBeNull();
  });
});

describe("normalizeVerdict", () => {
  it("accepts a well-formed pass", () => {
    const verdict = normalizeVerdict(
      {
        status: "pass",
        confidence: 0.9,
        evidence: ["Cable end visible at the brake arm"],
      },
      { model: "test" },
    );
    expect(verdict.status).toBe("pass");
    expect(verdict.confidence).toBe(0.9);
    expect(verdict.cached).toBe(false);
  });

  it("downgrades a pass with no evidence to unclear", () => {
    const verdict = normalizeVerdict(
      { status: "not_a_real_status", evidence: [] },
      { model: "test" },
    );
    expect(verdict.status).toBe("unclear");
  });

  it("refuses to pass a step without visual evidence", () => {
    const verdict = normalizeVerdict(
      { status: "pass", confidence: 0.99, evidence: [] },
      { model: "test" },
    );
    expect(verdict.status).toBe("unclear");
    expect(verdict.evidence.length).toBeGreaterThan(0);
  });

  it("keeps problem and fix for not_yet", () => {
    const verdict = normalizeVerdict(
      {
        status: "not_yet",
        confidence: "0.8",
        problem: "Cable sits beside the groove",
        fix: "Seat the cable in the groove",
        evidence: ["Groove is empty"],
      },
      { model: "test" },
    );
    expect(verdict.status).toBe("not_yet");
    expect(verdict.confidence).toBeCloseTo(0.8);
    expect(verdict.problem).toContain("beside the groove");
    expect(verdict.fix).toContain("Seat the cable");
  });

  it("downgrades not_yet with no stated problem to unclear", () => {
    const verdict = normalizeVerdict(
      { status: "not_yet", evidence: ["something looks off"] },
      { model: "test" },
    );
    expect(verdict.status).toBe("unclear");
  });

  it("clamps confidence into 0..1", () => {
    expect(
      normalizeVerdict(
        { status: "pass", confidence: 7, evidence: ["x"] },
        { model: "t" },
      ).confidence,
    ).toBe(1);
    expect(
      normalizeVerdict(
        { status: "pass", confidence: -3, evidence: ["x"] },
        { model: "t" },
      ).confidence,
    ).toBe(0);
  });

  it("handles null and garbage input without throwing", () => {
    expect(normalizeVerdict(null, { model: "t" }).status).toBe("unclear");
    expect(normalizeVerdict("nope", { model: "t" }).status).toBe("unclear");
    expect(normalizeVerdict([1, 2, 3], { model: "t" }).status).toBe("unclear");
  });

  it("never reports cached unless asked", () => {
    expect(normalizeVerdict(null, { model: "t" }).cached).toBe(false);
    expect(normalizeVerdict(null, { model: "t", cached: true }).cached).toBe(true);
  });
});

describe("normalizeWarnings", () => {
  it("accepts strings and objects", () => {
    const warnings = normalizeWarnings([
      "Unplug the drill first",
      { text: "Wear goggles", severity: "danger" },
    ]);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]!.severity).toBe("caution");
    expect(warnings[1]!.severity).toBe("danger");
  });

  it("de-duplicates repeated warnings case-insensitively", () => {
    const warnings = normalizeWarnings([
      "Wear goggles",
      "wear GOGGLES",
      "  Wear goggles  ",
    ]);
    expect(warnings).toHaveLength(1);
  });

  it("drops unusable entries", () => {
    expect(normalizeWarnings([null, "", "   ", 42, {}])).toHaveLength(0);
    expect(normalizeWarnings("not an array")).toHaveLength(0);
  });
});