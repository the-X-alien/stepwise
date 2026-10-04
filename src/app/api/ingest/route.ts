import { NextResponse } from "next/server";

import { buildGuide } from "@/lib/step-engine";
import { getDemoGuide, isOfflineMode } from "@/lib/demo-guides";
import { htmlToText, looksLikeUrl } from "@/lib/html-text";
import type { Guide } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_INPUT_CHARS = 60_000;

async function fetchGuideText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Identify honestly and ask for the plainest representation available.
        "user-agent": "Proofline/0.1 (hackathon project; step extractor)",
        accept: "text/html,text/plain;q=0.9,*/*;q=0.5",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const body = await res.text();
    const contentType = res.headers.get("content-type") ?? "";
    const text = contentType.includes("html") ? htmlToText(body) : body;
    return text.slice(0, MAX_INPUT_CHARS);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const record = body as Record<string, unknown> | null;
  const rawInput = typeof record?.input === "string" ? record.input : "";
  const requestedKind = record?.kind === "url" ? "url" : "text";

  // Loading a built-in demo guide by id is a first-class path, so the offline
  // demo never depends on parsing.
  const demoId = typeof record?.demoId === "string" ? record.demoId : null;
  if (demoId) {
    const guide = getDemoGuide(demoId);
    if (!guide) {
      return NextResponse.json({ error: "Unknown demo guide" }, { status: 404 });
    }
    return NextResponse.json({ guide, offline: isOfflineMode() });
  }

  const input = rawInput.trim();
  if (input.length < 20) {
    return NextResponse.json(
      { error: "Paste at least a few lines of the guide." },
      { status: 400 },
    );
  }

  const isUrl = looksLikeUrl(input);
  const kind: Guide["source"]["kind"] =
    isUrl || requestedKind === "url" ? "url" : "text";

  let text = input;
  if (kind === "url") {
    const fetched = await fetchGuideText(input);
    if (!fetched || fetched.length < 20) {
      return NextResponse.json(
        {
          error:
            "Could not read that page. Paste the guide text directly instead.",
        },
        { status: 422 },
      );
    }
    text = fetched;
  }

  let guide = buildGuide(text.slice(0, MAX_INPUT_CHARS), {
    source: { kind, ref: input.slice(0, 200) },
  });

  // A single recovered "step" means we did not actually find a guide — it is
  // prose that happened to contain one long sentence. Reject it rather than
  // handing the user a one-step guide that pretends to be useful.
  if (guide.steps.length < 2) {
    return NextResponse.json(
      {
        error:
          "No actionable steps found. Try a guide that is written as a numbered or bulleted list.",
      },
      { status: 422 },
    );
  }

  return NextResponse.json({ guide, offline: isOfflineMode() });
}