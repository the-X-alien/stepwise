import { NextResponse } from "next/server";

import { isOfflineMode } from "@/lib/demo-guides";
import { answerWithGroq, extractJsonObject } from "@/lib/groq";
import { buildFullGuideContext, offlineAnswer, retrieve, type ScoredStep } from "@/lib/rag";
import { buildGuide } from "@/lib/step-engine";
import type { AskAnswer, Guide } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

function isGuide(value: unknown): value is Guide {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.title === "string" && Array.isArray(record.steps);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const record = body as Record<string, unknown> | null;
  const question =
    typeof record?.question === "string" ? record.question.trim() : "";
  const stepIndex =
    typeof record?.stepIndex === "number" ? record.stepIndex : undefined;

  if (question.length < 3) {
    return NextResponse.json(
      { error: "Ask a question about the guide." },
      { status: 400 },
    );
  }

  // The guide arrives with the request so Q&A works with no server-side store.
  let guide = isGuide(record?.guide) ? (record!.guide as Guide) : null;
  if (!guide && typeof record?.guideText === "string") {
    guide = buildGuide(record.guideText, { source: { kind: "text", ref: "inline" } });
  }
  if (!guide) {
    return NextResponse.json({ error: "A guide is required" }, { status: 400 });
  }

  // Retrieval is deterministic and local: it always runs, even offline, and it
  // drives citations. It is not a gate — the whole guide is sent as context so
  // a "why" question or an unusual phrasing still gets a real answer.
  const scored = retrieve(guide, question, 3);
  const current = guide.steps.find((step) => step.index === stepIndex);
  const offlineSteps: ScoredStep[] =
    scored.length > 0
      ? scored
      : current
        ? [{ step: current, score: 1 }]
        : guide.steps[0]
          ? [{ step: guide.steps[0], score: 1 }]
          : [];

  if (isOfflineMode()) {
    return NextResponse.json({ answer: offlineAnswer(guide, offlineSteps) });
  }

  const raw = await answerWithGroq(
    question,
    buildFullGuideContext(guide, stepIndex),
  );

  if (!raw) {
    // Model unavailable — quote the best step we have, verbatim.
    return NextResponse.json({ answer: offlineAnswer(guide, offlineSteps) });
  }

  const parsed = raw as
    | { answer?: unknown; citations?: unknown; grounded?: unknown }
    | null;

  const answerText =
    typeof parsed?.answer === "string" && parsed.answer.trim().length > 0
      ? parsed.answer.trim()
      : offlineAnswer(guide, offlineSteps).answer;

  // Only accept citations that point at steps that actually exist.
  const validIndices = new Set(guide.steps.map((s) => s.index));
  const citations = Array.isArray(parsed?.citations)
    ? parsed!.citations.filter(
        (c): c is number => typeof c === "number" && validIndices.has(c),
      )
    : scored.map((s) => s.step.index);

  // "grounded" is the model's own claim, defaulted to whether we found a
  // matching step. The UI labels non-grounded answers as general advice.
  const grounded =
    typeof parsed?.grounded === "boolean"
      ? parsed.grounded
      : citations.length > 0;

  const answer: AskAnswer = {
    answer: answerText,
    citations: citations.length > 0 ? citations : offlineSteps.map((s) => s.step.index),
    grounded,
  };

  return NextResponse.json({ answer, currentStep: stepIndex ?? null });
}