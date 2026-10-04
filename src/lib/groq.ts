import type { Guide, GuideSource, Step } from "./types";
import { extractJsonObject } from "./verdict";

/** Groq is accessed only from server routes. Never prefix this key with NEXT_PUBLIC_. */
const CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
// These are overridable so the account owner can select a model available to
// their free plan. The app never switches service tiers or enables billing.
const TEXT_MODEL = process.env.GROQ_TEXT_MODEL ?? "openai/gpt-oss-20b";
const VISION_MODEL = process.env.GROQ_VISION_MODEL ?? "qwen/qwen3.8-27b";

export interface ResearchMaterial {
  id: string;
  title: string;
  url: string;
  kind: GuideSource["kind"];
  text: string;
}

interface GroqOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  model?: string;
  /** Completion cap. Vision calls keep this small to fit free-tier token limits. */
  maxTokens?: number;
}

interface ChatMessage {
  role: "system" | "user";
  content: string | Array<{
    type: "text" | "image_url";
    text?: string;
    image_url?: { url: string };
  }>;
}

type ChatOutcome =
  | { ok: true; data: unknown }
  | { ok: false; status: number | null };

async function chatOutcome(
  messages: ChatMessage[],
  options: GroqOptions = {},
): Promise<ChatOutcome> {
  const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;
  if (!apiKey?.trim()) return { ok: false, status: null };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 25_000);
  try {
    const response = await (options.fetchImpl ?? fetch)(CHAT_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey.trim()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: options.model ?? TEXT_MODEL,
        messages,
        temperature: 0.2,
        max_completion_tokens: options.maxTokens ?? 3000,
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) return { ok: false, status: response.status };
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { ok: false, status: null };
    const parsed = extractJsonObject(content);
    return parsed === null ? { ok: false, status: null } : { ok: true, data: parsed };
  } catch {
    // A rate limit, bad credential, or network failure degrades to source-only
    // mode. No retry loop: never burn quota or surprise the user with charges.
    return { ok: false, status: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Convenience wrapper: null means "no usable model answer" for every caller. */
async function chatJson(
  messages: ChatMessage[],
  options: GroqOptions = {},
): Promise<unknown | null> {
  const outcome = await chatOutcome(messages, options);
  return outcome.ok ? outcome.data : null;
}

const GUIDE_SYSTEM = `You turn sourced how-to information into a safe, clear beginner guide.
Use ONLY information supported by the supplied source extracts. Do not invent steps, tools, measurements, or safety warnings. If sources disagree, prefer the clearest authoritative source and mention uncertainty in the summary. If a warning appears in any source, preserve it and surface it before the steps.
Return JSON with: {"title": string, "summary": string, "warnings": [{"text": string, "severity": "danger"|"caution"}], "steps": [{"title": string, "instruction": string, "sourceQuote": string, "sourceIds": [string], "verifyHint": string, "tools": [string], "estSeconds": number|null}]}. Keep useful sourceIds from the IDs provided. Use 4-14 steps, one physical action per step. Plain language, no fluff.`;

/** Research-grounded synthesis. A null result is an honest no-key/offline fallback. */
export async function synthesizeGuide(
  query: string,
  materials: ResearchMaterial[],
  options: GroqOptions = {},
): Promise<unknown | null> {
  if (materials.length === 0) return null;
  const evidence = materials
    .map((item) =>
      `SOURCE ${item.id} (${item.kind})\nTitle: ${item.title}\nURL: ${item.url}\nExtract:\n${item.text.slice(0, 7_500)}`,
    )
    .join("\n\n---\n\n");
  return chatJson(
    [
      { role: "system", content: GUIDE_SYSTEM },
      {
        role: "user",
        content: `Task the user wants to do: ${query}\n\nResearch extracts:\n${evidence}`,
      },
    ],
    options,
  );
}

const ANSWER_SYSTEM = `You are a patient, practical how-to and troubleshooting assistant inside a step-by-step build guide.
Answer the question directly in the first sentence, then add only the one or two details that matter. You are given the whole guide, with a marker on the step the user is currently looking at.
Prefer the guide's own steps and wording, and quote step numbers where that helps.
If the guide does not cover the question, answer from general craft knowledge instead — but then you MUST set "grounded" to false so the interface can label it as general advice.
When the user says something went wrong, name the most likely cause and give one concrete recovery action they can take with the item in front of them right now.
Never invent steps that contradict the guide, and never drop a safety warning that applies.
Return JSON: {"answer": string, "citations": [step numbers], "grounded": boolean}.`;

export async function answerWithGroq(
  question: string,
  context: string,
  options: GroqOptions = {},
): Promise<unknown | null> {
  return chatJson(
    [
      { role: "system", content: ANSWER_SYSTEM },
      { role: "user", content: `${context}\n\nQuestion: ${question}` },
    ],
    options,
  );
}

const VISION_SYSTEM = `You are a careful build-step verifier. You are shown ONE photo of a user's work and asked whether ONE specific step is complete. The "Look for" line is the primary criterion.
Judge only what is actually visible in this photo. Never assume anything out of frame.

Return JSON: {"status":"pass"|"not_yet"|"unclear","confidence":0..1,"problem":string|null,"fix":string|null,"evidence":[string]}.

Rules:
- "pass" only when the visible details match the "Look for" description and the step is clearly complete. Evidence must list concrete details you can actually see.
- "not_yet" when the photo clearly shows the build at an earlier or different stage, or a visible mistake. Name the mismatch in "problem" and give one concrete corrective action in "fix".
- "unclear" when the photo is dark, blurry, off-target, or the expected feature is not visible. Never guess.
- Evidence must describe only visible details, never restate the instruction.
- If the visible work matches a different step of the guide better than this one, still use "not_yet" and say which step it looks like.`;

export type VerifyFailure = "rate_limited" | "unavailable";

export interface VerifyOutcome {
  raw: unknown | null;
  failure: VerifyFailure | null;
}

/**
 * Ask the vision model to judge a single step. Reports why a call failed so the
 * route can tell "wait ~20 seconds" apart from "the verifier is unreachable".
 */
export async function verifyWithGroq(
  imageDataUrl: string,
  guideTitle: string,
  step: Step,
  options: GroqOptions = {},
): Promise<VerifyOutcome> {
  const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(imageDataUrl);
  if (!apiKey?.trim() || !match) return { raw: null, failure: "unavailable" };

  const outcome = await chatOutcome(
    [
      { role: "system", content: VISION_SYSTEM },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Guide: ${guideTitle}\nStep ${step.index}: ${step.title}\nInstruction: ${step.instruction}\nLook for: ${step.verifyHint}\nJudge only this photo.`,
          },
          {
            type: "image_url",
            image_url: { url: imageDataUrl },
          },
        ],
      },
    ],
    // Keep the completion tiny: the free tier counts output against the vision
    // model's input-tokens-per-minute ceiling.
    { ...options, model: VISION_MODEL, maxTokens: 400 },
  );

  if (outcome.ok) return { raw: outcome.data, failure: null };
  return { raw: null, failure: outcome.status === 429 ? "rate_limited" : "unavailable" };
}

/** Validate untrusted model guide JSON against the source list and public types. */
export function guideFromSynthesis(
  raw: unknown,
  materials: ResearchMaterial[],
  query: string,
): Guide | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.steps)) return null;

  const sourceIds = new Set(materials.map((m) => m.id));
  const sources: GuideSource[] = materials.map((m) => ({
    id: m.id,
    title: m.title,
    url: m.url,
    kind: m.kind,
  }));

  let stepNumber = 0;
  const steps: Step[] = value.steps
    .slice(0, 14)
    .flatMap((entry: unknown, i: number): Step[] => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Record<string, unknown>;
      const instruction = typeof item.instruction === "string" ? item.instruction.trim() : "";
      if (instruction.length < 8) return [];
      const title = typeof item.title === "string" && item.title.trim()
        ? item.title.trim().slice(0, 120)
        : `Step ${i + 1}`;
      const ids = Array.isArray(item.sourceIds)
        ? item.sourceIds.filter((id): id is string => typeof id === "string" && sourceIds.has(id))
        : [];
      const tools = Array.isArray(item.tools)
        ? item.tools.filter((tool): tool is string => typeof tool === "string").slice(0, 8)
        : [];
      const seconds = typeof item.estSeconds === "number" && Number.isFinite(item.estSeconds)
        ? Math.max(0, Math.min(86_400, Math.round(item.estSeconds)))
        : null;
      stepNumber += 1;
      return [{
        index: stepNumber,
        title,
        instruction: instruction.slice(0, 1200),
        warnings: [],
        tools,
        estSeconds: seconds,
        sourceQuote: typeof item.sourceQuote === "string" ? item.sourceQuote.slice(0, 1000) : "",
        verifyHint: typeof item.verifyHint === "string" && item.verifyHint.trim()
          ? item.verifyHint.trim().slice(0, 300)
          : "Show the area you worked on.",
        sourceIds: ids,
      }];
    });

  if (steps.length < 2) return null;

  const rawWarnings = Array.isArray(value.warnings) ? value.warnings : [];
  const warnings: Guide["warnings"] = rawWarnings.flatMap((entry: unknown, i: number) => {
    if (typeof entry === "string" && entry.trim()) {
      return [{ id: `w${i + 1}`, text: entry.trim().slice(0, 500), severity: /danger|fire|electric|injur|death|toxic/i.test(entry) ? "danger" as const : "caution" as const }];
    }
    if (entry && typeof entry === "object") {
      const item = entry as Record<string, unknown>;
      if (typeof item.text !== "string" || !item.text.trim()) return [];
      return [{
        id: `w${i + 1}`,
        text: item.text.trim().slice(0, 500),
        severity: item.severity === "danger" ? "danger" as const : "caution" as const,
      }];
    }
    return [];
  }).slice(0, 12);

  const title = typeof value.title === "string" && value.title.trim()
    ? value.title.trim().slice(0, 120)
    : query.slice(0, 120);
  const summary = typeof value.summary === "string" && value.summary.trim()
    ? value.summary.trim().slice(0, 500)
    : `A source-grounded guide for ${query}.`;

  return {
    id: `research-${Date.now().toString(36)}`,
    title,
    summary,
    warnings,
    tools: [...new Set(steps.flatMap((step) => step.tools))],
    steps,
    source: { kind: "url", ref: sources[0]?.url ?? query },
    sources,
    createdAt: new Date().toISOString(),
  };
}

export { extractJsonObject };