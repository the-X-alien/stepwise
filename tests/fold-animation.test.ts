import { describe, expect, it } from "vitest";

import { foldDemoFor } from "@/lib/fold-animation";
import { PAPER_GUIDES } from "@/lib/paper-guides";
import type { Step } from "@/lib/types";

function stepOf(guideId: string, index: number): Step {
  const guide = PAPER_GUIDES.find((g) => g.id === guideId);
  if (!guide) throw new Error(`missing guide ${guideId}`);
  const step = guide.steps.find((s) => s.index === index);
  if (!step) throw new Error(`missing step ${guideId}:${index}`);
  return step;
}

describe("foldDemoFor", () => {
  it("maps a half fold", () => {
    expect(foldDemoFor(stepOf("paper-boat", 1)).kind).toBe("half");
  });

  it("maps a diagonal fold", () => {
    expect(foldDemoFor(stepOf("paper-frog", 2)).kind).toBe("diagonal");
  });

  it("maps a corner brought to the centre", () => {
    expect(foldDemoFor(stepOf("paper-fortune-teller", 2)).kind).toBe("corner");
  });

  it("maps a squash/petal fold", () => {
    expect(foldDemoFor(stepOf("paper-crane", 3)).kind).toBe("collapse");
  });

  it("maps turning the model over", () => {
    expect(foldDemoFor(stepOf("paper-fortune-teller", 3)).kind).toBe("flip");
  });

  it("maps opening the model out", () => {
    expect(foldDemoFor(stepOf("paper-crane", 8)).kind).toBe("open");
  });

  it("gives every paper step a caption and a valid crease", () => {
    const kinds = new Set(["half", "diagonal", "corner", "collapse", "flip", "open", "press"]);
    const creases = new Set(["horizontal", "vertical", "diagonal", "none"]);

    for (const guide of PAPER_GUIDES) {
      for (const step of guide.steps) {
        const demo = foldDemoFor(step);
        expect(kinds.has(demo.kind)).toBe(true);
        expect(creases.has(demo.crease)).toBe(true);
        expect(demo.caption.length).toBeGreaterThan(10);
      }
    }
  });

  it("falls back to a half fold for wording it does not recognise", () => {
    const step: Step = {
      index: 1,
      title: "Get ready",
      instruction: "Lay everything out on the table.",
      warnings: [],
      tools: [],
      estSeconds: null,
      sourceQuote: "",
      verifyHint: "",
    };
    expect(foldDemoFor(step).kind).toBe("half");
  });
});
