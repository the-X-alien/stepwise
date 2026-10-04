import { describe, expect, it } from "vitest";

import { DEMO_GUIDES } from "@/lib/demo-guides";
import { buildContext, offlineAnswer, retrieve, stem, tokenize } from "@/lib/rag";

const bikeGuide = DEMO_GUIDES.find((g) => g.id === "demo-bike-brake")!;

describe("stem / tokenize", () => {
  it("strips common suffixes", () => {
    expect(stem("screws")).toBe("screw");
    expect(stem("spin")).toBe("spin");
  });

  it("collapses word forms to one key so queries match guide wording", () => {
    // These pairs must agree, otherwise "how tight?" never matches "tighten".
    expect(stem("tightening")).toBe(stem("tighten"));
    expect(stem("tighten")).toBe(stem("tight"));
    expect(stem("loosen")).toBe(stem("loose"));
    expect(stem("cables")).toBe(stem("cable"));
  });

  it("leaves short words alone", () => {
    expect(stem("nut")).toBe("nut");
  });

  it("drops stop words", () => {
    // Stems are canonical, not the surface form: "tighten" collapses to
    // "tight" so it matches "tight"/"tightening" in the guide text.
    expect(tokenize("how do I tighten the screw")).toEqual(["tight", "screw"]);
  });
});

describe("retrieve", () => {
  it("finds the anchor-bolt step for an anchor question", () => {
    const scored = retrieve(bikeGuide, "how tight should the anchor bolt be?");
    expect(scored.length).toBeGreaterThan(0);
    expect(scored[0]!.step.index).toBe(4);
  });

  it("finds the pad clearance step", () => {
    const scored = retrieve(bikeGuide, "how much gap should the brake pads have?");
    expect(scored[0]!.step.index).toBe(5);
  });

  it("returns nothing for an unrelated question", () => {
    const scored = retrieve(bikeGuide, "what is the capital of France?");
    expect(scored).toEqual([]);
  });

  it("respects the result limit", () => {
    const scored = retrieve(bikeGuide, "cable brake lever anchor pad", 2);
    expect(scored.length).toBeLessThanOrEqual(2);
  });

  it("returns nothing for an empty question", () => {
    expect(retrieve(bikeGuide, "")).toEqual([]);
    expect(retrieve(bikeGuide, "   ")).toEqual([]);
  });
});

describe("buildContext", () => {
  it("includes step numbers and instruction text", () => {
    const scored = retrieve(bikeGuide, "anchor bolt");
    const context = buildContext(bikeGuide, scored);
    expect(context).toContain(`Step ${scored[0]!.step.index}`);
    expect(context).toContain(bikeGuide.title);
  });

  it("surfaces the warning attached to a retrieved step", () => {
    const scored = retrieve(bikeGuide, "test the brake");
    const context = buildContext(bikeGuide, scored);

    const withWarning = scored.find((s) => s.step.warnings.length > 0);
    expect(withWarning).toBeDefined();

    const warning = withWarning!.step.warnings[0]!;
    // The severity marker and the verbatim warning text must both survive
    // into the model's context — a warning that only exists in the UI would
    // let the model answer without ever seeing the safety constraint.
    expect(context).toContain(warning.severity.toUpperCase());
    expect(context).toContain(warning.text);
  });
});

describe("offlineAnswer", () => {
  it("quotes the retrieved step and cites it", () => {
    const scored = retrieve(bikeGuide, "anchor bolt");
    const answer = offlineAnswer(bikeGuide, scored);
    expect(answer.grounded).toBe(true);
    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.answer).toContain(`Step ${scored[0]!.step.index}`);
  });

  it("admits when it cannot find an answer", () => {
    const answer = offlineAnswer(bikeGuide, []);
    expect(answer.grounded).toBe(false);
    expect(answer.citations).toEqual([]);
    expect(answer.answer.toLowerCase()).toContain("couldn't find");
  });
});