import { normalizeWarnings } from "./verdict";
import type { Guide, Step, Warning, WarningSeverity } from "./types";

/**
 * Deterministic guide parser.
 *
 * This is the part of Proofline that is *not* an LLM. It runs on every guide,
 * it runs offline, and it is fully unit-tested. The model is only allowed to
 * improve on what this produces, never to invent steps that are not in the
 * source text.
 */

const WARNING_PATTERNS: Array<{ re: RegExp; severity: WarningSeverity }> = [
  {
    re: /\b(danger|warning|caution|CAUTION|hazard|risk of (?:death|injury|fire|electric)|electrocution|fatal|serious injury)\b/i,
    severity: "danger",
  },
  {
    re: /\b(do not|don't|never|avoid|disconnect|unplug|power off|turn off|shock|correction|warranty|do NOT)\b/i,
    severity: "caution",
  },
  {
    re: /\b(before you|make sure|ensure|only use|must be|required to)\b/i,
    severity: "caution",
  },
];

const STEP_HEADING_RE =
  /^\s*(?:step\s*)?(\d{1,2})\s*[.):\-–—]\s*(.*)$|^\s*step\s+(\d{1,2})\b(.*)$/i;

const BULLET_RE = /^\s*(?:[-*•·]|\d{1,2}[.)])\s+(.*)$/;

const TIME_RE =
  /\b(\d{1,3})\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i;

const TOOL_HINT_RE =
  /\b(screwdriver|wrench|allen key|hex key|drill|hammer|pliers|spanner|clamp|tape|gloves|goggles|multimeter|torque|zip tie|soldering iron|sand|printer|scissors|knife|bit)\b/i;

function sentenceCase(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return trimmed;
  const first = trimmed[0]!.toUpperCase();
  return first + trimmed.slice(1);
}

function stripTrailingPunctuation(input: string): string {
  return input.trim().replace(/[.;,]+$/, "");
}

/** Find the first warning-like sentence in a block of text. */
export function findWarning(text: string): Warning | null {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const sentence of sentences) {
    for (const { re, severity } of WARNING_PATTERNS) {
      if (re.test(sentence)) {
        const cleaned = stripTrailingPunctuation(sentence);
        if (cleaned.length < 8) continue;
        return { id: "w", text: sentenceCase(cleaned), severity };
      }
    }
  }
  return null;
}

export function estimateSeconds(text: string): number | null {
  const match = TIME_RE.exec(text);
  if (!match) return null;
  const value = Number.parseInt(match[1]!, 10);
  if (!Number.isFinite(value)) return null;
  const unit = match[2]!.toLowerCase();
  if (unit.startsWith("sec")) return value;
  if (unit.startsWith("min")) return value * 60;
  return value * 3600;
}

export function extractTools(text: string): string[] {
  const found = new Set<string>();
  const matches = text.match(new RegExp(TOOL_HINT_RE.source, "gi")) ?? [];
  for (const match of matches) {
    found.add(match.toLowerCase());
  }
  return [...found];
}

/**
 * Split raw guide text into candidate step bodies.
 *
 * Handles the three shapes guides actually arrive in: numbered headings,
 * bullet lists, and plain paragraphs.
 */
export function splitIntoStepBodies(input: string): string[] {
  const lines = input
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const numbered: string[] = [];
  for (const line of lines) {
    const match = STEP_HEADING_RE.exec(line);
    if (match) {
      const body = (match[2] ?? match[4] ?? "").trim();
      if (body.length > 0) numbered.push(body);
    } else if (numbered.length > 0) {
      // Continuation line belonging to the previous numbered step.
      const last = numbered.length - 1;
      if (!STEP_HEADING_RE.test(line) && !BULLET_RE.test(line)) {
        numbered[last] = `${numbered[last]!} ${line}`;
      }
    }
  }
  if (numbered.length >= 2) return numbered;

  // Bullet-list guides: a bullet line with a decent amount of text.
  const bullets: string[] = [];
  for (const line of lines) {
    const match = BULLET_RE.exec(line);
    if (match) {
      const body = match[1]!.trim();
      if (body.length >= 3) bullets.push(body);
    }
  }
  if (bullets.length >= 2) return bullets;

  // Plain prose: split on blank-line-separated blocks, then sentences.
  const blocks = input
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter((b) => b.length > 0);

  if (blocks.length >= 2) return blocks;

  return input
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
}

/**
 * Turn a step body into a short title and a plain-language instruction.
 * Titles are the first clause; the instruction keeps the full sentence.
 */
export function toTitle(body: string): string {
  const firstClause = body.split(/(?<=[.!?])\s+|\s*[;:]\s*/)[0] ?? body;
  const words = firstClause.split(/\s+/).slice(0, 8).join(" ");
  return stripTrailingPunctuation(sentenceCase(words)) || "Step";
}

function toVerifyHint(body: string): string {
  const lower = body.toLowerCase();
  if (/\b(connect|plug|insert|attach|seat|push|click)\b/.test(lower)) {
    return "Point the camera at the connection you just made.";
  }
  if (/\b(screw|bolt|tighten|fasten|loosen)\b/.test(lower)) {
    return "Point the camera at the fastener so the head is visible.";
  }
  if (/\b(align|line up|center|position|place)\b/.test(lower)) {
    return "Point the camera at the part so its alignment is visible.";
  }
  if (/\b(remove|take out|detach|unplug|disconnect)\b/.test(lower)) {
    return "Point the camera at where the part used to be.";
  }
  if (/\b(check|inspect|verify|test|measure)\b/.test(lower)) {
    return "Point the camera at the thing you are checking.";
  }
  return "Point the camera at the area you just worked on.";
}

/**
 * Build a `Guide` from raw text.
 *
 * Warnings are hoisted out of individual steps into `guide.warnings` (shown
 * before step 1) while remaining attached to their originating step, because
 * the rubric rewards surfacing risk up front *and* in context.
 */
export function buildGuide(
  rawText: string,
  options: { source: Guide["source"]; title?: string; id?: string },
): Guide {
  const cleaned = rawText.replace(/\r\n?/g, "\n").trim();
  const bodies = splitIntoStepBodies(cleaned);

  const steps: Step[] = [];
  const hoisted: Warning[] = [];

  bodies.forEach((body, i) => {
    const stepWarnings: Warning[] = [];
    const warning = findWarning(body);
    if (warning) {
      stepWarnings.push({ ...warning, id: `s${i + 1}-w1` });
      hoisted.push({ ...warning, id: `h${hoisted.length + 1}` });
    }

    steps.push({
      index: i + 1,
      title: toTitle(body),
      instruction: sentenceCase(stripTrailingPunctuation(body)),
      warnings: stepWarnings,
      tools: extractTools(body),
      estSeconds: estimateSeconds(body),
      sourceQuote: body,
      verifyHint: toVerifyHint(body),
    });
  });

  const firstLine = cleaned.split("\n")[0]?.trim() ?? "";
  const title =
    options.title?.trim() ||
    (firstLine.length > 3 && firstLine.length < 90 && !STEP_HEADING_RE.test(firstLine)
      ? stripTrailingPunctuation(firstLine)
      : "Untitled guide");

  const allTools = [...new Set(steps.flatMap((s) => s.tools))];
  const summary =
    steps.length === 0
      ? "No actionable steps were found in this guide."
      : `${steps.length} step${steps.length === 1 ? "" : "s"} in the fastest safe order${
          hoisted.length > 0
            ? `, with ${hoisted.length} warning${hoisted.length === 1 ? "" : "s"} to read first`
            : ""
        }.`;

  return {
    id: options.id ?? `g${Math.random().toString(36).slice(2, 10)}`,
    title,
    summary,
    warnings: normalizeWarnings(hoisted),
    tools: allTools,
    steps,
    source: options.source,
    createdAt: new Date().toISOString(),
  };
}