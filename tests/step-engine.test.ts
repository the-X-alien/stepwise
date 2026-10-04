import { describe, expect, it } from "vitest";

import {
  buildGuide,
  estimateSeconds,
  extractTools,
  findWarning,
  splitIntoStepBodies,
} from "@/lib/step-engine";

describe("splitIntoStepBodies", () => {
  it("parses numbered steps", () => {
    const bodies = splitIntoStepBodies(
      "1. Loosen the bolt.\n2. Remove the cover.\n3. Tighten the screw.",
    );
    expect(bodies).toEqual([
      "Loosen the bolt.",
      "Remove the cover.",
      "Tighten the screw.",
    ]);
  });

  it("parses 'Step N' headings", () => {
    const bodies = splitIntoStepBodies(
      "Step 1: Unplug the machine\nStep 2: Open the panel",
    );
    expect(bodies).toEqual(["Unplug the machine", "Open the panel"]);
  });

  it("parses bullet lists when there are no numbers", () => {
    const bodies = splitIntoStepBodies(
      "- Align the bracket\n- Insert the pin\n- Secure the clip",
    );
    expect(bodies).toHaveLength(3);
  });

  it("folds continuation lines into the previous step", () => {
    const bodies = splitIntoStepBodies(
      "1. Loosen the bolt\nwith a 5 mm key\n2. Remove the cover",
    );
    expect(bodies[0]).toBe("Loosen the bolt with a 5 mm key");
    expect(bodies).toHaveLength(2);
  });

  it("falls back to prose sentences", () => {
    const bodies = splitIntoStepBodies(
      "First you should remove the old filter. Then you push the new filter into place. Finally you close the housing.",
    );
    expect(bodies.length).toBeGreaterThanOrEqual(3);
  });

  it("returns an empty list for empty input", () => {
    expect(splitIntoStepBodies("")).toEqual([]);
    expect(splitIntoStepBodies("   \n  \n ")).toEqual([]);
  });
});

describe("findWarning", () => {
  it("flags danger language as danger", () => {
    const warning = findWarning("Danger: risk of electrocution if the case is open.");
    expect(warning?.severity).toBe("danger");
  });

  it("flags do-not language as caution", () => {
    const warning = findWarning("Do not overtighten the bolt or you will strip it.");
    expect(warning?.severity).toBe("caution");
  });

  it("returns null for neutral text", () => {
    expect(findWarning("Align the bracket and press it into place.")).toBeNull();
  });
});

describe("estimateSeconds", () => {
  it("parses seconds, minutes and hours", () => {
    expect(estimateSeconds("Wait 30 seconds")).toBe(30);
    expect(estimateSeconds("Let it sit for 5 minutes")).toBe(300);
    expect(estimateSeconds("Cure for 2 hours")).toBe(7200);
  });

  it("returns null when there is no duration", () => {
    expect(estimateSeconds("Tighten the bolt")).toBeNull();
  });
});

describe("extractTools", () => {
  it("finds tools mentioned in the text", () => {
    const tools = extractTools("Use a 5 mm hex key and a screwdriver.");
    expect(tools).toContain("hex key");
    expect(tools).toContain("screwdriver");
  });

  it("returns an empty array when no tools are mentioned", () => {
    expect(extractTools("Press the button.")).toEqual([]);
  });
});

describe("buildGuide", () => {
  const sample = `Install the shelf bracket
1. Mark the drill holes with a pencil. This takes about 2 minutes.
2. Warning: wear goggles before you drill into the wall.
3. Drill the holes with a 6 mm bit.
4. Screw the bracket to the wall. Do not overtighten the screws.`;

  it("builds steps with sequential indices", () => {
    const guide = buildGuide(sample, { source: { kind: "text", ref: "t" } });
    expect(guide.steps.length).toBe(4);
    expect(guide.steps.map((s) => s.index)).toEqual([1, 2, 3, 4]);
  });

  it("hoists warnings to the top while keeping them on the step", () => {
    const guide = buildGuide(sample, { source: { kind: "text", ref: "t" } });
    expect(guide.warnings.length).toBeGreaterThanOrEqual(2);

    const dangerStep = guide.steps.find((s) => s.warnings.length > 0);
    expect(dangerStep).toBeDefined();
    expect(guide.summary).toContain("warning");
  });

  it("never duplicates a warning in the hoisted list", () => {
    const guide = buildGuide(sample, { source: { kind: "text", ref: "t" } });
    const texts = guide.warnings.map((w) => w.text.toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("keeps the verbatim source quote for provenance", () => {
    const guide = buildGuide(sample, { source: { kind: "text", ref: "t" } });
    for (const step of guide.steps) {
      expect(step.sourceQuote.length).toBeGreaterThan(0);
    }
  });

  it("produces no steps when there is no usable text", () => {
    const guide = buildGuide("", { source: { kind: "text", ref: "t" } });
    expect(guide.steps).toEqual([]);
  });

  it("collects tools across all steps", () => {
    const guide = buildGuide(sample, { source: { kind: "text", ref: "t" } });
    expect(guide.tools).toContain("drill");
  });
});