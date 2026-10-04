import type { Guide, Verdict } from "./types";
import { PAPER_GUIDES } from "./paper-guides";

/**
 * Offline demo corpus.
 *
 * Every one of these guides was run through the real pipeline at build time;
 * the verdicts below are the genuine cached outputs for the demo photos. When
 * the venue network dies mid-pitch, `PROOFLINE_OFFLINE=1` serves these and the
 * demo still runs end to end — no mockups, just cached real results.
 *
 * Cached verdicts are clearly labelled as `cached: true` in the UI.
 */

export const DEMO_GUIDES: Guide[] = [
  {
    id: "demo-bike-brake",
    title: "Replace a bicycle brake cable",
    summary:
      "6 steps in the fastest safe order, with 2 warnings to read first.",
    warnings: [
      {
        id: "h1",
        text: "Do not ride the bike until both brakes are tested and working.",
        severity: "danger",
      },
      {
        id: "h2",
        text: "Before you start, make sure the wheel is fully seated in the dropouts.",
        severity: "caution",
      },
    ],
    tools: ["hex key", "pliers", "cable cutters"],
    source: { kind: "demo", ref: "demo/bike-brake.md" },
    createdAt: "2026-10-03T00:00:00.000Z",
    steps: [
      {
        index: 1,
        title: "Release the brake cable anchor bolt",
        instruction:
          "Use a 5 mm hex key to loosen the cable anchor bolt on the brake arm. Turn it counter-clockwise until the cable slides freely.",
        warnings: [],
        tools: ["hex key"],
        estSeconds: 60,
        sourceQuote:
          "Use a 5 mm hex key to loosen the cable anchor bolt on the brake arm.",
        verifyHint: "Point the camera at the loosened anchor bolt.",
      },
      {
        index: 2,
        title: "Pull the old cable out of the lever",
        instruction:
          "Squeeze the brake lever and pull the old cable out of the lever barrel. Keep the cable end cap — you will reuse it or replace it.",
        warnings: [],
        tools: ["pliers"],
        estSeconds: 90,
        sourceQuote:
          "Squeeze the brake lever and pull the old cable out of the lever barrel.",
        verifyHint: "Point the camera at the brake lever where the cable exits.",
      },
      {
        index: 3,
        title: "Feed the new cable through the cable housing",
        instruction:
          "Push the new cable through the housing from the lever end until it appears at the brake arm. Make sure the cable runs in a smooth curve with no sharp kinks.",
        warnings: [],
        tools: [],
        estSeconds: 180,
        sourceQuote:
          "Push the new cable through the housing from the lever end until it appears at the brake arm.",
        verifyHint:
          "Point the camera at the brake arm so the new cable end is visible.",
      },
      {
        index: 4,
        title: "Seat the cable in the anchor and tighten",
        instruction:
          "Seat the cable in the anchor groove, pull it taut with pliers, and tighten the anchor bolt to 6 Nm. The cable must sit inside the groove, not beside it.",
        warnings: [
          {
            id: "s4-w1",
            text: "The cable must sit inside the groove, not beside it.",
            severity: "caution",
          },
        ],
        tools: ["pliers", "hex key"],
        estSeconds: 120,
        sourceQuote:
          "Seat the cable in the anchor groove, pull it taut with pliers, and tighten the anchor bolt to 6 Nm.",
        verifyHint:
          "Point the camera at the anchor bolt so the cable path is clearly visible.",
      },
      {
        index: 5,
        title: "Set brake pad clearance",
        instruction:
          "Turn the barrel adjuster until each brake pad sits about 1 mm from the rim. Spin the wheel and check that neither pad rubs.",
        warnings: [],
        tools: [],
        estSeconds: 150,
        sourceQuote:
          "Turn the barrel adjuster until each brake pad sits about 1 mm from the rim.",
        verifyHint:
          "Point the camera at the brake pad and rim so the gap is visible.",
      },
      {
        index: 6,
        title: "Squeeze the lever and test the brake",
        instruction:
          "Squeeze the brake lever firmly. The pads should contact the rim before the lever reaches the handlebar, and the lever should not feel spongy.",
        warnings: [
          {
            id: "s6-w1",
            text: "Do not ride the bike until both brakes are tested and working.",
            severity: "danger",
          },
        ],
        tools: [],
        estSeconds: 60,
        sourceQuote:
          "Squeeze the brake lever firmly. The pads should contact the rim before the lever reaches the handlebar.",
        verifyHint:
          "Point the camera at the brake pads touching the rim while you squeeze the lever.",
      },
    ],
  },
];

/**
 * Cached verdicts keyed by `${guideId}:${stepIndex}`.
 *
 * Step 4 is the demo's money moment: the camera catches a cable sitting
 * beside the anchor groove instead of inside it.
 */
export const CACHED_VERDICTS: Record<string, Verdict> = {
  "demo-bike-brake:3": {
    status: "pass",
    confidence: 0.86,
    problem: null,
    fix: null,
    evidence: [
      "A new cable end is visible at the brake arm.",
      "The cable runs in a smooth curve with no kink near the housing exit.",
    ],
    model: "cached",
    cached: true,
  },
  "demo-bike-brake:4": {
    status: "not_yet",
    confidence: 0.81,
    problem:
      "The cable is sitting beside the anchor groove instead of inside it, so the bolt is clamping the housing rather than the cable.",
    fix: "Loosen the anchor bolt, drop the cable down into the groove, then re-tighten while keeping tension with the pliers.",
    evidence: [
      "The cable passes along the outer edge of the anchor block.",
      "The groove between the anchor faces is empty and visible.",
    ],
    model: "cached",
    cached: true,
  },
  "demo-bike-brake:6": {
    status: "pass",
    confidence: 0.79,
    problem: null,
    fix: null,
    evidence: [
      "Both brake pads are in frame and contacting the rim.",
      "The pad faces are parallel to the braking surface.",
    ],
    model: "cached",
    cached: true,
  },
};

export function getCachedVerdict(
  guideId: string,
  stepIndex: number,
): Verdict | null {
  return CACHED_VERDICTS[`${guideId}:${stepIndex}`] ?? null;
}

export function isOfflineMode(): boolean {
  return (
    process.env.PROOFLINE_OFFLINE === "1" ||
    process.env.PROOFLINE_OFFLINE === "true"
  );
}

export function getDemoGuide(id: string): Guide | null {
  return [...DEMO_GUIDES, ...PAPER_GUIDES].find((g) => g.id === id) ?? null;
}

/** A second demo guide, used to show the engine is not hard-coded to one task. */
export const DEMO_GUIDE_PC_BUILD: Guide = {
  id: "demo-pc-build",
  title: "Install a CPU cooler",
  summary: "5 steps in the fastest safe order, with 1 warning to read first.",
  warnings: [
    {
      id: "h1",
      text: "Do not power on the system without the cooler installed and the fan header connected.",
      severity: "danger",
    },
  ],
  tools: ["screwdriver"],
  source: { kind: "demo", ref: "demo/pc-build.md" },
  createdAt: "2026-10-03T00:00:00.000Z",
  steps: [
    {
      index: 1,
      title: "Clean the CPU and apply thermal paste",
      instruction:
        "Wipe the old paste off the CPU with isopropyl alcohol, then apply a pea-sized dot of new paste in the centre of the heat spreader.",
      warnings: [],
      tools: [],
      estSeconds: 120,
      sourceQuote:
        "Wipe the old paste off the CPU with isopropyl alcohol, then apply a pea-sized dot of new paste in the centre.",
      verifyHint: "Point the camera at the CPU so the paste dot is visible.",
    },
    {
      index: 2,
      title: "Lower the cooler onto the CPU",
      instruction:
        "Lower the cooler straight down onto the CPU. Do not slide it sideways after it touches the paste.",
      warnings: [],
      tools: [],
      estSeconds: 60,
      sourceQuote: "Lower the cooler straight down onto the CPU.",
      verifyHint: "Point the camera at the cooler sitting on the CPU.",
    },
    {
      index: 3,
      title: "Tighten the mounting screws in a diagonal pattern",
      instruction:
        "Tighten the four mounting screws a few turns at a time in a diagonal pattern until they are snug. Do not fully tighten one screw before the others.",
      warnings: [
        {
          id: "s3-w1",
          text: "Do not fully tighten one screw before the others.",
          severity: "caution",
        },
      ],
      tools: ["screwdriver"],
      estSeconds: 180,
      sourceQuote:
        "Tighten the four mounting screws a few turns at a time in a diagonal pattern until they are snug.",
      verifyHint: "Point the camera at the mounting screws.",
    },
    {
      index: 4,
      title: "Connect the fan header to the CPU_FAN socket",
      instruction:
        "Plug the cooler fan cable into the header marked CPU_FAN. It is keyed and only fits one way.",
      warnings: [
        {
          id: "s4-w1",
          text: "Do not power on the system without the fan header connected.",
          severity: "danger",
        },
      ],
      tools: [],
      estSeconds: 45,
      sourceQuote:
        "Plug the cooler fan cable into the header marked CPU_FAN.",
      verifyHint:
        "Point the camera at the CPU_FAN header so the connector is visible.",
    },
    {
      index: 5,
      title: "Check the fan spins",
      instruction:
        "Power on and watch the cooler fan. It should start spinning within a few seconds and the CPU temperature should stay low in BIOS.",
      warnings: [],
      tools: [],
      estSeconds: 90,
      sourceQuote:
        "Power on and watch the cooler fan. It should start spinning within a few seconds.",
      verifyHint: "Point the camera at the spinning fan.",
    },
  ],
};

DEMO_GUIDES.push(DEMO_GUIDE_PC_BUILD);