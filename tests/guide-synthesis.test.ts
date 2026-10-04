import { describe, expect, it } from "vitest";
import { guideFromSynthesis, type ResearchMaterial } from "@/lib/groq";

const sources: ResearchMaterial[] = [
  { id: "article-1", title: "Crane guide", url: "https://example.org/crane", kind: "article", text: "Fold a square diagonally." },
];

describe("guideFromSynthesis", () => {
  it("accepts steps with source citations and drops fabricated source IDs", () => {
    const guide = guideFromSynthesis({
      title: "Fold a paper crane",
      summary: "Beginner guide.",
      warnings: [{ text: "Start with a square sheet.", severity: "caution" }],
      steps: [
        { title: "Fold diagonally", instruction: "Fold the square paper diagonally from corner to corner.", sourceQuote: "Fold the paper diagonally.", sourceIds: ["article-1", "invented"], verifyHint: "Show the diagonal crease.", tools: [], estSeconds: 30 },
        { title: "Open it", instruction: "Open the paper flat and check the diagonal crease is visible.", sourceQuote: "Open the paper flat.", sourceIds: ["article-1"], verifyHint: "Show the crease.", tools: [], estSeconds: null },
      ],
    }, sources, "paper crane");
    expect(guide?.steps).toHaveLength(2);
    expect(guide?.steps[0]?.sourceIds).toEqual(["article-1"]);
    expect(guide?.sources?.[0]?.url).toBe("https://example.org/crane");
    expect(guide?.warnings).toHaveLength(1);
  });

  it("fills a default camera hint when the model omits or blanks it", () => {
    const guide = guideFromSynthesis({
      steps: [
        { title: "Fold", instruction: "Fold the square paper diagonally from corner to corner.", verifyHint: "   " },
        { title: "Open", instruction: "Open the paper flat and press the crease down." },
      ],
    }, sources, "paper crane");
    expect(guide?.steps[0]?.verifyHint).toBe("Show the area you worked on.");
    expect(guide?.steps[1]?.verifyHint).toBe("Show the area you worked on.");
  });

  it("refuses malformed or one-step model output", () => {
    expect(guideFromSynthesis(null, sources, "crane")).toBeNull();
    expect(guideFromSynthesis({ steps: [{ instruction: "Too short" }] }, sources, "crane")).toBeNull();
  });
});