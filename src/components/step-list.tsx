"use client";

import type { Step, Verdict } from "@/lib/types";

export interface StepState {
  /** The user tapped "done". */
  claimed: boolean;
  /** The camera confirmed it. */
  verified: boolean;
  verdict: Verdict | null;
}

function formatSeconds(seconds: number | null): string | null {
  if (seconds === null) return null;
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

export function StepList({
  steps,
  states,
  activeIndex,
  onSelect,
  onReadAloud,
}: {
  steps: Step[];
  states: Record<number, StepState>;
  activeIndex: number;
  onSelect: (index: number) => void;
  onReadAloud?: (step: Step) => void;
}) {
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
      {steps.map((step) => {
        const state = states[step.index];
        const isActive = step.index === activeIndex;
        const est = formatSeconds(step.estSeconds);

        return (
          <li
            key={step.index}
            className={state?.verified ? "step-done" : undefined}
            style={{
              border: `1px solid ${isActive ? "var(--accent)" : "var(--line)"}`,
              borderRadius: 12,
              background: isActive ? "var(--panel-2)" : "var(--panel)",
              padding: 12,
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div
                aria-hidden
                style={{
                  flex: "0 0 auto",
                  width: 26,
                  height: 26,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  background: state?.verified ? "var(--pass)" : "var(--panel-2)",
                  color: state?.verified ? "#061024" : "var(--text)",
                  fontWeight: 800,
                  fontSize: "0.8rem",
                  border: "1px solid var(--line)",
                }}
              >
                {state?.verified ? "✓" : step.index}
              </div>

              <button
                onClick={() => onSelect(step.index)}
                style={{
                  flex: 1,
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "inherit",
                }}
                aria-current={isActive ? "step" : undefined}
              >
                <div style={{ fontWeight: 700, fontSize: "0.98rem" }}>
                  {step.title}
                  {state?.claimed && !state.verified && (
                    <span
                      className="badge"
                      style={{
                        marginLeft: 8,
                        background: "var(--warn)",
                        color: "#061024",
                      }}
                    >
                      claimed
                    </span>
                  )}
                </div>
                <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
                  {step.instruction}
                </p>
                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                    fontSize: "0.78rem",
                    color: "var(--muted)",
                  }}
                >
                  {est && <span>⏱ {est}</span>}
                  {step.tools.length > 0 && <span>🧰 {step.tools.join(", ")}</span>}
                  {state?.verdict && (
                    <span
                      style={{
                        color:
                          state.verdict.status === "pass"
                            ? "var(--pass)"
                            : state.verdict.status === "not_yet"
                              ? "var(--warn)"
                              : "var(--muted)",
                        fontWeight: 700,
                      }}
                    >
                      {state.verdict.status === "pass"
                        ? "camera verified"
                        : state.verdict.status === "not_yet"
                          ? "camera: not yet"
                          : "camera: unclear"}
                    </span>
                  )}
                </div>
              </button>

              {onReadAloud && (
                <button
                  className="btn btn-ghost"
                  onClick={() => onReadAloud(step)}
                  title="Read this step aloud"
                  aria-label={`Read step ${step.index} aloud`}
                  style={{ padding: "0.4rem 0.6rem" }}
                >
                  🔊
                </button>
              )}
            </div>

            {step.warnings.map((warning) => (
              <div
                key={warning.id}
                style={{
                  marginTop: 10,
                  padding: "8px 10px",
                  borderRadius: 10,
                  fontSize: "0.85rem",
                  background:
                    warning.severity === "danger"
                      ? "rgba(239,68,68,0.14)"
                      : "rgba(245,158,11,0.12)",
                  border: `1px solid ${
                    warning.severity === "danger"
                      ? "rgba(239,68,68,0.5)"
                      : "rgba(245,158,11,0.4)"
                  }`,
                }}
              >
                <strong>
                  {warning.severity === "danger" ? "Danger: " : "Caution: "}
                </strong>
                {warning.text}
              </div>
            ))}
          </li>
        );
      })}
    </ol>
  );
}