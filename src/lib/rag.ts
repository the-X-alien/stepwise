import type { AskAnswer, Guide, Step } from "./types";

/**
 * On-device retrieval over a single guide.
 *
 * Deliberately dependency-free: no embeddings API, no API key, no rate limit,
 * no per-query cost. Guides are short (tens of steps), so a lexical scorer
 * with stemming and IDF weighting retrieves accurately enough to ground an
 * answer — and it works with the network unplugged, which matters at a venue.
 *
 * The retriever's job is to pick which steps are relevant and hand them to the
 * model as context. When nothing scores, we say so instead of guessing.
 */

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "do", "does",
  "for", "from", "how", "i", "if", "in", "is", "it", "its", "me", "my", "of",
  "on", "or", "should", "so", "that", "the", "then", "there", "this", "to",
  "was", "what", "when", "where", "which", "why", "will", "with", "you",
  "your",
]);

/**
 * Suffix stripper for retrieval matching.
 *
 * Ordering matters: the longest, most specific suffixes are tried first so
 * "tightening" collapses all the way to "tight" in a single pass, and
 * "loosen"/"loose" converge on the same key. Getting these to agree is what
 * lets a user's question match the guide's wording rather than failing on a
 * word-form mismatch.
 */
const SUFFIXES = ["ening", "ingly", "edly", "ing", "ed", "en", "es", "ly", "s"];

export function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length <= 3) return w;

  for (const suffix of SUFFIXES) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
      w = w.slice(0, w.length - suffix.length);
      break;
    }
  }

  // Normalize a trailing "e" so "loose"/"loosen" and "cable"/"cables" agree.
  if (w.length >= 5 && w.endsWith("e")) {
    w = w.slice(0, -1);
  }

  return w;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
    .map(stem);
}

export interface ScoredStep {
  step: Step;
  score: number;
}

function stepText(step: Step): string {
  return [
    step.title,
    step.instruction,
    step.sourceQuote,
    step.tools.join(" "),
    step.warnings.map((w) => w.text).join(" "),
  ].join(" ");
}

/**
 * Rank guide steps against a question using TF-IDF-ish weighting.
 * Returns only steps above a relevance floor, best first.
 */
export function retrieve(guide: Guide, question: string, limit = 3): ScoredStep[] {
  const queryTokens = tokenize(question);
  if (queryTokens.length === 0) return [];

  const docs = guide.steps.map((step) => {
    const tokens = tokenize(stepText(step));
    const counts = new Map<string, number>();
    for (const token of tokens) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
    return { step, counts, length: Math.max(1, tokens.length) };
  });

  // Document frequency across steps, for IDF.
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const token of new Set(doc.counts.keys())) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }

  const total = Math.max(1, docs.length);

  const scored: ScoredStep[] = docs.map((doc) => {
    let score = 0;
    for (const token of queryTokens) {
      const tf = doc.counts.get(token) ?? 0;
      if (tf === 0) continue;
      const idf = Math.log(1 + total / (df.get(token) ?? 1));
      score += (tf / doc.length) * idf * 10;
    }
    // Small bonus for the step the user is currently looking at.
    return { step: doc.step, score };
  });

  const best = Math.max(0, ...scored.map((s) => s.score));
  const floor = best * 0.15;

  return scored
    .filter((s) => s.score > 0 && s.score >= floor)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Full-guide context for Q&A.
 *
 * Retrieval alone can legitimately score nothing — a "why" question, or a
 * synonym the guide never uses — and refusing to answer then reads as broken.
 * Guides are short, so hand the model every step plus a marker for the step the
 * user is looking at, and let retrieval inform citations instead.
 */
export function buildFullGuideContext(
  guide: Guide,
  currentStepIndex?: number,
): string {
  const lines = guide.steps.map((step) => {
    const warnings = step.warnings
      .map((w) => ` [${w.severity.toUpperCase()}: ${w.text}]`)
      .join("");
    const marker =
      step.index === currentStepIndex ? " <-- the user is on this step" : "";
    return `Step ${step.index} — ${step.title}${marker}\n${step.instruction}${warnings}`;
  });
  const warnings = guide.warnings
    .map((w) => ` [${w.severity.toUpperCase()}: ${w.text}]`)
    .join("");
  return `Guide: ${guide.title}\nSummary: ${guide.summary}${
    warnings ? `\nGuide warnings:${warnings}` : ""
  }\n\nAll steps:\n${lines.join("\n\n")}`;
}

/** Build the grounded prompt context handed to the model. */
export function buildContext(guide: Guide, scored: ScoredStep[]): string {
  const lines = scored.map(({ step }) => {
    const warnings = step.warnings.map((w) => ` [${w.severity.toUpperCase()}: ${w.text}]`).join("");
    return `Step ${step.index} — ${step.title}\n${step.instruction}${warnings}`;
  });
  return `Guide: ${guide.title}\n\nRelevant steps:\n${lines.join("\n\n")}`;
}

/**
 * Fallback answer when the model is unavailable. Quotes the retrieved steps
 * verbatim so the answer is still grounded in the real guide.
 */
export function offlineAnswer(guide: Guide, scored: ScoredStep[]): AskAnswer {
  if (scored.length === 0) {
    return {
      answer: `I couldn't find anything in "${guide.title}" that covers that. Try rephrasing, or tap the step you're stuck on.`,
      citations: [],
      grounded: false,
    };
  }

  const top = scored[0]!.step;
  const warning = top.warnings[0];
  const suffix = warning ? ` Careful here — ${warning.text}` : "";

  return {
    answer: `Step ${top.index} ("${top.title}") is the relevant one: ${top.instruction}${suffix}`,
    citations: scored.map((s) => s.step.index),
    grounded: true,
  };
}