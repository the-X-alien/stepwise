/**
 * Proofline data contract.
 *
 * These types are the single source of truth shared by the ingest pipeline,
 * the vision verifier, the AR overlay, and the UI. Every value that crosses
 * the network is validated against them (see `verdict.ts` and `step-engine.ts`).
 */

export type WarningSeverity = "danger" | "caution";

export interface Warning {
  id: string;
  text: string;
  severity: WarningSeverity;
}

export interface GuideSource {
  id: string;
  title: string;
  url: string;
  kind: "article" | "video" | "text" | "url" | "demo";
}

export interface Step {
  /** 1-based position in the safe path. */
  index: number;
  title: string;
  instruction: string;
  /** Warnings attached to this specific step. */
  warnings: Warning[];
  tools: string[];
  /** Rough time estimate in seconds, or null when unknown. */
  estSeconds: number | null;
  /** Verbatim line from the source guide, for provenance/citations. */
  sourceQuote: string;
  /** What the camera should be looking at to verify this step. */
  verifyHint: string;
  /** IDs of sources supporting this synthesized step. */
  sourceIds?: string[];
}

export interface Guide {
  id: string;
  title: string;
  summary: string;
  /** Warnings hoisted to the top of the guide (shown before step 1). */
  warnings: Warning[];
  tools: string[];
  steps: Step[];
  source: {
    kind: "text" | "url" | "demo";
    ref: string;
  };
  /** Web pages/videos backing the synthesized guide, when researched. */
  sources?: GuideSource[];
  createdAt: string;
}

export type VerdictStatus = "pass" | "not_yet" | "unclear";

export interface Verdict {
  status: VerdictStatus;
  /** 0..1, clamped. */
  confidence: number;
  /** What is wrong, when status is `not_yet`. */
  problem: string | null;
  /** The specific corrective action, when status is `not_yet`. */
  fix: string | null;
  /** Short observable details that drove the decision. */
  evidence: string[];
  /** Which engine produced this verdict. */
  model: string;
  /** True when served from the offline cache. */
  cached: boolean;
}

export interface IngestRequest {
  /** Raw pasted guide text, or a URL to fetch. */
  input: string;
  kind?: "text" | "url";
}

export interface VerifyRequest {
  guideId: string;
  stepIndex: number;
  /** JPEG data URL captured from the camera. */
  image: string;
  step: Step;
  guideTitle: string;
}

export interface AskRequest {
  guideId: string;
  question: string;
  stepIndex?: number;
}

export interface AskAnswer {
  answer: string;
  /** Step indices the answer is grounded in. */
  citations: number[];
  grounded: boolean;
}

export const VERDICT_STATUSES: readonly VerdictStatus[] = [
  "pass",
  "not_yet",
  "unclear",
];