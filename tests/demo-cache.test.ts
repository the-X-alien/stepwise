import { describe, expect, it } from "vitest";

import {
  CACHED_VERDICTS,
  DEMO_GUIDES,
  getCachedVerdict,
  getDemoGuide,
} from "@/lib/demo-guides";

describe("demo guides", () => {
  it("ships at least two distinct guides", () => {
    expect(DEMO_GUIDES.length).toBeGreaterThanOrEqual(2);
    const ids = DEMO_GUIDES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every guide real steps and at least one hoisted warning", () => {
    for (const guide of DEMO_GUIDES) {
      expect(guide.steps.length).toBeGreaterThanOrEqual(4);
      expect(guide.warnings.length).toBeGreaterThanOrEqual(1);
      expect(guide.summary.length).toBeGreaterThan(0);
    }
  });

  it("indexes steps sequentially from 1", () => {
    for (const guide of DEMO_GUIDES) {
      expect(guide.steps.map((s) => s.index)).toEqual(
        guide.steps.map((_, i) => i + 1),
      );
    }
  });

  it("gives every step a verify hint so the camera knows what to look at", () => {
    for (const guide of DEMO_GUIDES) {
      for (const step of guide.steps) {
        expect(step.verifyHint.length).toBeGreaterThan(10);
      }
    }
  });
});

describe("cached verdicts", () => {
  it("resolves a cached verdict by guide and step", () => {
    const verdict = getCachedVerdict("demo-bike-brake", 4);
    expect(verdict?.status).toBe("not_yet");
    expect(verdict?.cached).toBe(true);
  });

  it("returns null for an uncached step", () => {
    expect(getCachedVerdict("demo-bike-brake", 99)).toBeNull();
  });

  it("only references steps that exist in the guide", () => {
    for (const key of Object.keys(CACHED_VERDICTS)) {
      const [guideId, stepIndexRaw] = key.split(":");
      const guide = getDemoGuide(guideId!);
      expect(guide).not.toBeNull();
      const stepIndex = Number.parseInt(stepIndexRaw!, 10);
      expect(guide!.steps.some((s) => s.index === stepIndex)).toBe(true);
    }
  });

  it("gives every not_yet cached verdict an actionable fix", () => {
    for (const verdict of Object.values(CACHED_VERDICTS)) {
      if (verdict.status === "not_yet") {
        expect(verdict.problem).toBeTruthy();
        expect(verdict.fix).toBeTruthy();
      }
    }
  });

  it("marks every cached verdict as cached", () => {
    for (const verdict of Object.values(CACHED_VERDICTS)) {
      expect(verdict.cached).toBe(true);
    }
  });
});