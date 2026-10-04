import {
  VERDICT_STATUSES,
  type Verdict,
  type VerdictStatus,
  type Warning,
  type WarningSeverity,
} from "./types";

/**
 * Strict validation for anything the model returns.
 *
 * A vision model will eventually return a status we did not ask for, a
 * confidence as a string, or prose wrapped in code fences. None of that is
 * allowed to reach the UI as-is: we coerce it into the contract, and when the
 * shape is genuinely unusable we degrade to `unclear` rather than inventing a
 * pass. "I can't tell — take a closer photo" is an honest verdict; a fake pass
 * is not.
 */

const WARNING_SEVERITIES: readonly WarningSeverity[] = ["danger", "caution"];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function clamp01(value: unknown, fallback = 0): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

export function isVerdictStatus(value: unknown): value is VerdictStatus {
  return (
    typeof value === "string" &&
    (VERDICT_STATUSES as readonly string[]).includes(value)
  );
}

export function isWarningSeverity(value: unknown): value is WarningSeverity {
  return (
    typeof value === "string" &&
    (WARNING_SEVERITIES as readonly string[]).includes(value)
  );
}

/**
 * Pull a JSON object out of model output that may be fenced or padded with
 * prose. Returns null when no object can be recovered.
 */
export function extractJsonObject(raw: string): unknown {
  const text = raw.trim();
  if (text.length === 0) return null;

  const withoutFences = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const candidates = [withoutFences];

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    candidates.push(text.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/**
 * Coerce arbitrary model output into a `Verdict`.
 *
 * `pass` is only ever returned when the model explicitly said `pass` AND the
 * evidence list is non-empty. An unsupported pass is downgraded to `unclear`.
 */
export function normalizeVerdict(
  raw: unknown,
  options: { model: string; cached?: boolean },
): Verdict {
  const record = asRecord(raw);

  const base: Verdict = {
    status: "unclear",
    confidence: 0,
    problem: null,
    fix: null,
    evidence: [],
    model: options.model,
    cached: options.cached ?? false,
  };

  if (!record) {
    return {
      ...base,
      evidence: ["No structured verdict was returned by the verifier."],
    };
  }

  const status = isVerdictStatus(record.status) ? record.status : "unclear";

  const rawEvidence = Array.isArray(record.evidence) ? record.evidence : [];
  const evidence = rawEvidence
    .map(asTrimmedString)
    .filter((v): v is string => v !== null)
    .slice(0, 6);

  const problem = asTrimmedString(record.problem);
  const fix = asTrimmedString(record.fix);

  // A pass with nothing observed is not a pass.
  if (status === "pass" && evidence.length === 0) {
    return {
      ...base,
      status: "unclear",
      confidence: clamp01(record.confidence, 0.2),
      evidence: ["The verifier reported a pass without describing what it saw."],
    };
  }

  // A failure with no stated problem is not actionable; surface it as unclear.
  if (status === "not_yet" && problem === null) {
    return {
      ...base,
      status: "unclear",
      confidence: clamp01(record.confidence, 0.2),
      evidence,
    };
  }

  return {
    status,
    confidence: clamp01(record.confidence, status === "unclear" ? 0 : 0.5),
    problem: status === "not_yet" ? problem : null,
    fix: status === "not_yet" ? fix : null,
    evidence,
    model: options.model,
    cached: options.cached ?? false,
  };
}

/**
 * Normalize a list of warnings from any source, dropping unusable entries and
 * de-duplicating by text so the top-of-guide banner never repeats itself.
 */
export function normalizeWarnings(raw: unknown): Warning[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const warnings: Warning[] = [];

  for (const entry of raw) {
    let text: string | null = null;
    let severity: WarningSeverity = "caution";

    const asString = asTrimmedString(entry);
    if (asString) {
      text = asString;
    } else {
      const record = asRecord(entry);
      if (record) {
        text = asTrimmedString(record.text);
        if (isWarningSeverity(record.severity)) {
          severity = record.severity;
        }
      }
    }

    if (!text) continue;

    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    warnings.push({
      id: `w${warnings.length + 1}`,
      text,
      severity,
    });
  }

  return warnings;
}