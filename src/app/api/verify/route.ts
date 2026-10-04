import { NextResponse } from "next/server";

import { getCachedVerdict, isOfflineMode } from "@/lib/demo-guides";
import { verifyWithGroq } from "@/lib/groq";
import { normalizeVerdict } from "@/lib/verdict";
import type { Step } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_IMAGE_CHARS = 6_000_000; // ~4.5 MB of base64 payload

function isStep(value: unknown): value is Step {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.index === "number" &&
    typeof record.title === "string" &&
    typeof record.instruction === "string"
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const record = body as Record<string, unknown> | null;
  const guideId = typeof record?.guideId === "string" ? record.guideId : "";
  const guideTitle =
    typeof record?.guideTitle === "string" ? record.guideTitle : "Untitled guide";
  const stepIndex =
    typeof record?.stepIndex === "number" ? record.stepIndex : -1;
  const image = typeof record?.image === "string" ? record.image : "";
  const step = record?.step;

  if (!guideId || stepIndex < 1 || !isStep(step)) {
    return NextResponse.json(
      { error: "guideId, stepIndex and step are required" },
      { status: 400 },
    );
  }

  // Cache first: makes the demo instant and network-proof.
  const cached = getCachedVerdict(guideId, stepIndex);
  if (cached) {
    return NextResponse.json({ verdict: cached });
  }

  if (!image) {
    return NextResponse.json(
      { error: "A photo is required to verify a step." },
      { status: 400 },
    );
  }

  if (image.length > MAX_IMAGE_CHARS) {
    return NextResponse.json(
      { error: "That photo is too large. Try again." },
      { status: 413 },
    );
  }

  if (isOfflineMode()) {
    return NextResponse.json({
      verdict: normalizeVerdict(
        {
          status: "unclear",
          confidence: 0,
          evidence: [
            "Offline demo mode is on and no cached verdict exists for this step.",
          ],
        },
        { model: "offline" },
      ),
    });
  }

  const { raw, failure } = await verifyWithGroq(image, guideTitle, step);

  if (!raw) {
    // No key, no network, or a rate limit. Say exactly which, honestly.
    const rateLimited = failure === "rate_limited";
    return NextResponse.json({
      verdict: normalizeVerdict(
        {
          status: "unclear",
          confidence: 0,
          evidence: [
            rateLimited
              ? "Groq's free-tier rate limit was hit for this minute. Wait about 20 seconds, then capture again — or mark the step finished by hand."
              : "The verifier could not be reached. Check the connection, or keep using the step list.",
          ],
        },
        { model: rateLimited ? "rate-limited" : "unavailable" },
      ),
    });
  }

  return NextResponse.json({
    verdict: normalizeVerdict(raw, { model: process.env.GROQ_VISION_MODEL ?? "qwen/qwen3.8-27b" }),
  });
}