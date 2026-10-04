"use client";

import type { Verdict } from "@/lib/types";

const STATUS_META: Record<
  Verdict["status"],
  { label: string; color: string; icon: string }
> = {
  pass: { label: "Step verified", color: "var(--pass)", icon: "✓" },
  not_yet: { label: "Not yet", color: "var(--warn)", icon: "!" },
  unclear: { label: "Can't tell", color: "var(--muted)", icon: "?" },
};

export function VerdictCard({
  verdict,
  onRetry,
}: {
  verdict: Verdict;
  onRetry?: () => void;
}) {
  const meta = STATUS_META[verdict.status];

  return (
    <div
      className="panel"
      style={{ padding: 14, borderColor: meta.color, marginTop: 12 }}
      role="status"
      aria-live="polite"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          className="badge"
          style={{ background: meta.color, color: "#061024" }}
        >
          {meta.icon} {meta.label}
        </span>
        {verdict.status !== "unclear" && (
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
            {Math.round(verdict.confidence * 100)}% confidence
            {verdict.cached ? " · cached" : ""}
          </span>
        )}
      </div>

      {verdict.status === "not_yet" && verdict.problem && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>What&apos;s wrong</div>
          <p style={{ margin: "4px 0 0", color: "var(--text)" }}>{verdict.problem}</p>
        </div>
      )}

      {verdict.status === "not_yet" && verdict.fix && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
            background: "rgba(245,158,11,0.12)",
            border: "1px solid rgba(245,158,11,0.4)",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Do this next</div>
          <p style={{ margin: "4px 0 0" }}>{verdict.fix}</p>
        </div>
      )}

      {verdict.evidence.length > 0 && (
        <ul
          style={{
            margin: "10px 0 0",
            paddingLeft: 18,
            color: "var(--muted)",
            fontSize: "0.88rem",
          }}
        >
          {verdict.evidence.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}

      {verdict.status === "unclear" && onRetry && (
        <button className="btn" style={{ marginTop: 10 }} onClick={onRetry}>
          Take another photo
        </button>
      )}
    </div>
  );
}