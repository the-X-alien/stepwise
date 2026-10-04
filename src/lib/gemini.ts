import type { Step } from "./types";
import { extractJsonObject } from "./verdict";

/**
 * Gemini free-tier client.
 *
 * Free tier only — no paid key, no billing account, no credit spend. If the
 * key is missing or the network is down, every function here returns null and
 * the caller falls back to deterministic or cached behaviour. The demo must
 * survive a dead venue network.
 */

const MODEL = "gemini-2.0-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiOptions {
  apiKey?: string | undefined;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function resolveKey(options?: GeminiOptions): string | null {
  const key = options?.apiKey ?? process.env.GEMINI_API_KEY ?? "";
  return key.trim().length > 0 ? key.trim() : null;
}

async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
}

async function callGemini(
  parts: GeminiPart[],
  systemInstruction: string,
  options?: GeminiOptions,
): Promise<string | null> {
  const key = resolveKey(options);
  if (!key) return null;

  const doFetch = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 20_000;

  return withTimeout(async (signal) => {
    const res = await doFetch(`${ENDPOINT}/${MODEL}:generateContent?key=${key}`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) return null;

    const json = (await res.json()) as GeminiResponse;
    const text = json.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();

    return text && text.length > 0 ? text : null;
  }, timeoutMs);
}

const VERIFIER_SYSTEM = `You are Proofline's step verifier. A user is following a build guide.
You are shown ONE photo of their work and asked whether ONE specific step is complete.

Judge only what is visible. Never assume a part is correct because it is out of frame.

Return ONLY a JSON object with this exact shape:
{
  "status": "pass" | "not_yet" | "unclear",
  "confidence": 0.0-1.0,
  "problem": string or null,
  "fix": string or null,
  "evidence": [string, ...]
}

Rules:
- "pass": the step is visibly complete and correct. "evidence" must list at least one concrete thing you saw.
- "not_yet": something visible is wrong or incomplete. "problem" states exactly what, "fix" states the one corrective action.
- "unclear": the photo is too dark, blurry, or off-target to judge. Do not guess. This is the correct answer when you cannot see.
- Never return "pass" without concrete visual evidence.
- "evidence" entries must describe what is visible, not restate the instruction.`;

export interface VisionInput {
  imageDataUrl: string;
  guideTitle: string;
  step: Step;
}

/** Ask the vision model to judge a single step. Returns raw text or null. */
export async function verifyStepWithGemini(
  input: VisionInput,
  options?: GeminiOptions,
): Promise<string | null> {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(input.imageDataUrl);
  if (!match) return null;

  const mimeType = match[1]!;
  const data = match[2]!;

  const prompt = `Guide: ${input.guideTitle}
Step ${input.step.index}: ${input.step.title}
Instruction the user was asked to perform: ${input.step.instruction}
What the camera should be showing: ${input.step.verifyHint}

Judge whether this step is complete based only on the photo.`;

  return callGemini(
    [{ text: prompt }, { inlineData: { mimeType, data } }],
    VERIFIER_SYSTEM,
    options,
  );
}

const ANSWER_SYSTEM = `You are Proofline, a patient build assistant.
Answer the user's question using ONLY the guide steps provided as context.
If the context does not cover the question, say so plainly — do not invent steps.

Return ONLY JSON:
{ "answer": string, "citations": [step numbers], "grounded": boolean }`;

export interface AnswerInput {
  question: string;
  context: string;
}

/** Answer a question grounded in retrieved guide context. */
export async function answerWithGemini(
  input: AnswerInput,
  options?: GeminiOptions,
): Promise<string | null> {
  return callGemini(
    [{ text: `${input.context}\n\nUser question: ${input.question}`,
      },
    ],
    ANSWER_SYSTEM,
    options,
  );
}

const SIMPLIFY_SYSTEM = `You rewrite build-guide steps so a beginner can follow them.
Keep every fact, tool, and safety detail. Do not add steps that are not implied by the source.
Never remove a warning.

Return ONLY JSON: { "steps": [{ "index": number, "title": string, "instruction": string }] }`;

export interface SimplifyInput {
  guideTitle: string;
  steps: Array<{ index: number; instruction: string }>;
}

/** Ask the model to simplify step wording. Returns raw text or null. */
export async function simplifyStepsWithGemini(
  input: SimplifyInput,
  options?: GeminiOptions,
): Promise<string | null> {
  const list = input.steps
    .map((s) => `${s.index}. ${s.instruction}`)
    .join("\n");

  return callGemini(
    [{ text: `Guide: ${input.guideTitle}\n\nSteps:\n${list}` }],
    SIMPLIFY_SYSTEM,
    options,
  );
}

export { extractJsonObject };