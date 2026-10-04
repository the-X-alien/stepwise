"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { foldDemoFor } from "@/lib/fold-animation";
import type { AskAnswer, Guide, Step } from "@/lib/types";

/**
 * "Show me" panel: a looping paper-fold animation of the step, plus a
 * stuck-button row that asks the AI what usually goes wrong here.
 *
 * The panel lives inline in the workbench instead of a modal so the step list
 * and camera stay visible while the animation plays.
 */

const STUCK_QUESTIONS = [
  "My fold is crooked or off-centre — how do I fix it?",
  "My paper looks nothing like this step — what did I skip?",
  "I can't tell which side of the paper should face up.",
];

export function StepDemo({
  guide,
  step,
  onClose,
}: {
  guide: Guide;
  step: Step;
  onClose: () => void;
}) {
  const demo = useMemo(() => foldDemoFor(step), [step]);
  const [paused, setPaused] = useState(false);
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);

  // A new step means a new animation and a fresh answer.
  useEffect(() => {
    setAnswer(null);
    setAsked(null);
    setError(null);
    setPaused(false);
    setRunId((id) => id + 1);
  }, [step.index]);

  const replay = useCallback(() => {
    setPaused(false);
    setRunId((id) => id + 1);
  }, []);

  const readAloud = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      `Step ${step.index}. ${step.title}. ${step.instruction}`,
    );
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }, [step]);

  const askForHelp = useCallback(
    async (question: string) => {
      setAsking(true);
      setError(null);
      setAsked(question);
      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            guide,
            question: `I am stuck on step ${step.index} of "${guide.title}" — ${step.title}. ${question}`,
            stepIndex: step.index,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Couldn't get help right now.");
        setAnswer(result.answer as AskAnswer);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Couldn't get help right now.");
      } finally {
        setAsking(false);
      }
    },
    [guide, step],
  );

  return (
    <section className="step-demo" aria-label={`Animated demonstration of step ${step.index}`}>
      <div className="step-demo-head">
        <div>
          <span className="eyebrow">SHOW ME · STEP {step.index}</span>
          <h3>{step.title}</h3>
        </div>
        <button className="quiet-button" onClick={onClose}>
          Close
        </button>
      </div>

      <div
        className={paused ? "fold-stage paused" : "fold-stage"}
        key={runId}
        data-kind={demo.kind}
      >
        <div className={`fold-paper fold-${demo.kind}`}>
          <div className="fold-base" />
          <div className="fold-flap" />
          <div className="fold-flap fold-flap-second" />
          {demo.crease !== "none" && (
            <span className={`fold-crease ${demo.crease}`} />
          )}
          <span className="fold-arrow" aria-hidden>
            ↻
          </span>
        </div>
      </div>

      <p className="fold-caption">{demo.caption}</p>
      {step.verifyHint && <p className="fold-watch">Looks right when: {step.verifyHint}</p>}

      <div className="step-actions">
        <button className="secondary-action" onClick={() => setPaused((value) => !value)}>
          {paused ? "▶ Play again" : "❚❚ Pause"}
        </button>
        <button className="secondary-action" onClick={replay}>
          ↻ Replay
        </button>
        <button className="secondary-action" onClick={readAloud}>
          🔊 Read the step
        </button>
      </div>

      <div className="stuck-box">
        <span className="eyebrow">MESSED IT UP?</span>
        <p className="stuck-lede">Tell the AI what went wrong and it will walk you back to this step.</p>
        <div className="stuck-chips">
          {STUCK_QUESTIONS.map((question) => (
            <button
              key={question}
              className="chip-button"
              onClick={() => void askForHelp(question)}
              disabled={asking}
              aria-pressed={asked === question}
            >
              {question}
            </button>
          ))}
        </div>
        {asking && <p className="stuck-lede">Thinking…</p>}
        {answer && (
          <div className="answer-card">
            <p>{answer.answer}</p>
            {answer.grounded && answer.citations.length > 0 && (
              <small>
                From step{answer.citations.length > 1 ? "s" : ""} {answer.citations.join(", ")}
              </small>
            )}
            {!answer.grounded && <small>General craft advice — not from this guide&apos;s steps.</small>}
          </div>
        )}
        {error && (
          <p className="error-note" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
