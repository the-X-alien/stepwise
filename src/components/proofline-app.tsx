"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CameraAr, type CameraArHandle } from "@/components/camera-ar";
import { StepDemo } from "@/components/step-demo";
import { StepList, type StepState } from "@/components/step-list";
import { VerdictCard } from "@/components/verdict-card";
import type { AskAnswer, Guide, Step, Verdict } from "@/lib/types";

interface SearchHit {
  id: string;
  title: string;
  url: string;
  kind: "article" | "video";
  snippet: string;
}

const PAPER_STARTERS = [
  { id: "paper-crane", title: "Origami crane", detail: "8 folds · classic", icon: "🕊️", tone: "lavender" },
  { id: "paper-frog", title: "Jumping frog", detail: "8 folds · playful", icon: "🐸", tone: "lime" },
  { id: "paper-boat", title: "Paper boat", detail: "6 folds · beginner", icon: "⛵", tone: "blue" },
  { id: "paper-airplane", title: "Paper airplane", detail: "7 folds · fly it", icon: "✈️", tone: "peach" },
  { id: "paper-fortune-teller", title: "Fortune teller", detail: "8 folds · game", icon: "🔮", tone: "yellow" },
  { id: "paper-heart", title: "Paper heart", detail: "7 folds · gift", icon: "💌", tone: "rose" },
];

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "That didn't work. Please try again.");
  return result as T;
}

export default function ProoflineApp() {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [building, setBuilding] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [activeTab, setActiveTab] = useState<"discover" | "link" | "paste">("discover");
  const [directUrl, setDirectUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [states, setStates] = useState<Record<number, StepState>>({});
  const [activeIndex, setActiveIndex] = useState(1);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  const cameraRef = useRef<CameraArHandle | null>(null);

  const activeStep = useMemo(
    () => guide?.steps.find((step) => step.index === activeIndex) ?? null,
    [guide, activeIndex],
  );
  const verifiedCount = Object.values(states).filter((item) => item.verified).length;
  const selectedHits = hits.filter((hit) => selected.includes(hit.id));
  const articles = hits.filter((hit) => hit.kind === "article");
  const videos = hits.filter((hit) => hit.kind === "video");

  const showGuide = useCallback((next: Guide, synthesized: boolean, extraWarnings: string[] = []) => {
    setGuide(next);
    setStates({});
    setActiveIndex(next.steps[0]?.index ?? 1);
    setVerdict(null);
    setAnswer(null);
    setAskError(null);
    setShowDemo(false);
    setError(null);
    setNotice(extraWarnings[0] ?? (synthesized ? "Steps synthesized from the sources you chose." : "Showing a clear guide built from the tutorial."));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const runSearch = useCallback(async (term = query) => {
    const value = term.trim();
    if (value.length < 3) {
      setError("Type what you want to make first.");
      return;
    }
    setQuery(value);
    setSearching(true);
    setError(null);
    setSearchDone(false);
    setHits([]);
    setSelected([]);
    try {
      const data = await postJson<{ hits: SearchHit[]; warnings?: string[] }>("/api/research", { action: "search", query: value });
      setHits(data.hits ?? []);
      setSearchDone(true);
      setSelected((data.hits ?? []).slice(0, 2).map((hit) => hit.id));
      if (!data.hits?.length) setNotice(data.warnings?.[0] ?? "No results came back. Try a different phrase, a direct link, or paste the tutorial.");
      else setNotice(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Search is temporarily unavailable.");
      setSearchDone(true);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const startWithPaper = useCallback(async (id: string) => {
    setBuilding(true);
    setError(null);
    try {
      const data = await postJson<{ guide: Guide; synthesized: boolean }>("/api/research", { action: "demo", demoId: id });
      showGuide(data.guide, false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't open this fold.");
    } finally {
      setBuilding(false);
    }
  }, [showGuide]);

  const makeGuide = useCallback(async () => {
    if (selectedHits.length === 0) return;
    setBuilding(true);
    setError(null);
    try {
      const data = await postJson<{ guide: Guide; synthesized: boolean; warnings?: string[] }>("/api/research", {
        action: "build", query, sources: selectedHits,
      });
      showGuide(data.guide, data.synthesized, data.warnings);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't make a guide from those sources.");
    } finally {
      setBuilding(false);
    }
  }, [query, selectedHits, showGuide]);

  const makeFromLink = useCallback(async () => {
    if (!directUrl.trim()) return;
    setBuilding(true);
    setError(null);
    try {
      const data = await postJson<{ guide: Guide; synthesized: boolean; warnings?: string[] }>("/api/research", { action: "direct", url: directUrl.trim() });
      showGuide(data.guide, data.synthesized, data.warnings);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't read that tutorial.");
    } finally {
      setBuilding(false);
    }
  }, [directUrl, showGuide]);

  const makeFromPaste = useCallback(async () => {
    if (pasteText.trim().length < 30) {
      setError("Paste a little more of the tutorial so the guide has enough detail.");
      return;
    }
    setBuilding(true);
    setError(null);
    try {
      const data = await postJson<{ guide: Guide; synthesized: boolean; warnings?: string[] }>("/api/research", {
        action: "paste", title: pasteTitle.trim() || "Pasted tutorial", text: pasteText,
      });
      showGuide(data.guide, data.synthesized, data.warnings);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't read that tutorial.");
    } finally {
      setBuilding(false);
    }
  }, [pasteText, pasteTitle, showGuide]);

  const updateStep = useCallback((index: number, patch: Partial<StepState>) => {
    setStates((previous) => ({
      ...previous,
      [index]: {
        claimed: previous[index]?.claimed ?? false,
        verified: previous[index]?.verified ?? false,
        verdict: previous[index]?.verdict ?? null,
        ...patch,
      },
    }));
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const verifyStep = useCallback(async () => {
    if (!guide || !activeStep) return;
    setVerifying(true);
    setError(null);
    try {
      const image = cameraRef.current?.capture() ?? "";
      const data = await postJson<{ verdict: Verdict }>("/api/verify", {
        guideId: guide.id, guideTitle: guide.title, stepIndex: activeStep.index, step: activeStep, image,
      });
      setVerdict(data.verdict);
      if (data.verdict.model === "rate-limited") setCooldown(20);
      updateStep(activeStep.index, { claimed: true, verified: data.verdict.status === "pass", verdict: data.verdict });
      if (data.verdict.status === "pass") {
        const next = guide.steps.find((step) => step.index > activeStep.index);
        if (next) setActiveIndex(next.index);
        setShowDemo(false);
        setAnswer(null);
        setNotice(next ? `Step ${activeStep.index} verified. On to step ${next.index}.` : "All done — you've reached the last step.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't verify that step.");
    } finally {
      setVerifying(false);
    }
  }, [guide, activeStep, updateStep]);

  const askAboutStep = useCallback(async () => {
    if (!guide) return;
    if (question.trim().length < 3) {
      setAskError("Type a full question first — a few words is enough.");
      return;
    }
    setAsking(true);
    setAskError(null);
    try {
      const data = await postJson<{ answer: AskAnswer }>("/api/ask", { guide, question, stepIndex: activeIndex });
      setAnswer(data.answer);
    } catch (cause) {
      setAskError(cause instanceof Error ? cause.message : "The AI couldn't answer that yet. Try again.");
    } finally {
      setAsking(false);
    }
  }, [guide, question, activeIndex]);

  const speak = useCallback((step: Step) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`Step ${step.index}. ${step.title}. ${step.instruction}`);
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  }, []);

  const backToDiscover = useCallback(() => {
    setGuide(null);
    setError(null);
    setNotice(null);
    setVerdict(null);
    setStates({});
  }, []);

  if (guide) {
    return (
      <main className="app-shell guide-shell">
        <header className="topbar">
          <button className="brand-button" onClick={backToDiscover} aria-label="Step by Step home"><span className="brand-mark">S</span><span>step by step</span></button>
          <button className="quiet-button" onClick={backToDiscover}>← Explore guides</button>
        </header>
        <div className="guide-heading">
          <div><span className="eyebrow">YOUR WORKSHOP · {guide.steps.length} SMALL STEPS</span><h1>{guide.title}</h1><p>{guide.summary}</p></div>
          <div className="progress-chip"><span>{verifiedCount}</span> / {guide.steps.length} verified</div>
        </div>
        {notice && <div className="notice-strip">✦ {notice}</div>}
        {guide.warnings.length > 0 && <section className="safety-panel"><div className="safety-icon">!</div><div><strong>Before you begin</strong><ul>{guide.warnings.map((warning) => <li key={warning.id}>{warning.text}</li>)}</ul></div></section>}
        {guide.sources?.length ? <section className="source-strip"><span>BUILT FROM</span>{guide.sources.map((source) => <a key={source.id} href={source.url || undefined} target="_blank" rel="noreferrer">{source.kind === "video" ? "▶ " : "↗ "}{source.title}</a>)}</section> : null}
        <div className="guide-layout">
          <section className="steps-column"><div className="section-kicker">THE FOLD, ONE MOVE AT A TIME</div><StepList steps={guide.steps} states={states} activeIndex={activeIndex} onSelect={(index) => { setActiveIndex(index); setVerdict(states[index]?.verdict ?? null); setAnswer(null); setAskError(null); setShowDemo(false); }} onReadAloud={speak} /></section>
          <aside className="workbench-column"><div className="workbench-card"><span className="eyebrow">STEP {activeStep?.index ?? 1} OF {guide.steps.length}</span><h2>{activeStep?.title}</h2><p className="work-instruction">{activeStep?.instruction}</p>{activeStep?.verifyHint && <p className="camera-hint">↗ {activeStep.verifyHint}</p>}
            <div className="step-actions"><button className="secondary-action" onClick={() => { if (activeStep) { updateStep(activeStep.index, { claimed: true }); setNotice("Noted. Camera check is available below when you want a second opinion."); } }}>✓ I finished this</button><button className="secondary-action show-me-button" onClick={() => setShowDemo((value) => !value)} aria-expanded={showDemo}>{showDemo ? "Hide the animation" : "✨ Show me how"}</button></div>
            {showDemo && activeStep && <StepDemo guide={guide} step={activeStep} onClose={() => setShowDemo(false)} />}
            <CameraAr className="camera-widget" hint={activeStep?.verifyHint ?? "Show your paper"} stepIndex={activeStep?.index ?? 1} stepTitle={activeStep?.title ?? ""} onReady={(handle) => { cameraRef.current = handle; }}><button className="primary-action capture-button" onClick={verifyStep} disabled={verifying || cooldown > 0}>{cooldown > 0 ? `Wait ${cooldown}s` : verifying ? "Checking…" : "Capture & check"}</button></CameraAr>
            {verdict && <VerdictCard verdict={verdict} onRetry={() => setVerdict(null)} />}
            <div className="ask-box"><span className="eyebrow">NEED A HAND?</span><label htmlFor="ask-input">Ask the AI about any step</label><div className="ask-row"><input id="ask-input" className="text-input" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void askAboutStep(); }} placeholder="Why do I fold this corner?"/><button className="secondary-action" onClick={askAboutStep} disabled={asking}>{asking ? "Thinking…" : "Ask AI"}</button></div>{asking && <p className="ask-status">Asking the AI…</p>}{answer && <div className="answer-card"><p>{answer.answer}</p>{answer.grounded && answer.citations.length > 0 && <small>From step{answer.citations.length > 1 ? "s" : ""} {answer.citations.join(", ")}</small>}{!answer.grounded && <small>General guidance — not from this guide&apos;s steps.</small>}</div>}{askError && <p className="error-note" role="alert">{askError}</p>}</div>
            {error && <p className="error-note" role="alert">{error}</p>}
          </div></aside>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell discover-shell">
      <header className="topbar"><button className="brand-button" aria-label="Step by Step home"><span className="brand-mark">S</span><span>step by step</span></button><span className="topbar-note">A calmer way to figure it out.</span><span className="free-pill"><i /> free to explore</span></header>
      <section className="hero-section">
        <div className="hero-copy"><span className="eyebrow"><span className="sparkle">✳</span> LESS SEARCHING. MORE MAKING.</span><h1>Make it.<br/><em>Step by clear step.</em></h1><p>Tell us what you want to make. We’ll find useful tutorials, bring the clearest steps together, and stay by your side while you build.</p></div>
        <div className="hero-art" aria-hidden="true"><div className="paper-shape paper-one">✳</div><div className="paper-shape paper-two">⌁</div><div className="paper-shape paper-three">↗</div><div className="art-caption">ideas, unfolded</div></div>
      </section>
      <section className="maker-card">
        <div className="tabs" role="tablist" aria-label="Choose how to start"><button role="tab" aria-selected={activeTab === "discover"} className={activeTab === "discover" ? "tab active" : "tab"} onClick={() => setActiveTab("discover")}>⌕ <span>Find tutorials</span></button><button role="tab" aria-selected={activeTab === "link"} className={activeTab === "link" ? "tab active" : "tab"} onClick={() => setActiveTab("link")}>↗ <span>Use a link</span></button><button role="tab" aria-selected={activeTab === "paste"} className={activeTab === "paste" ? "tab active" : "tab"} onClick={() => setActiveTab("paste")}>▤ <span>Paste instructions</span></button></div>
        {activeTab === "discover" && <div className="maker-content"><label className="field-label" htmlFor="task-search">What are you trying to make?</label><div className="search-row"><span className="search-icon">⌕</span><input id="task-search" className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runSearch(); }} placeholder="e.g. a paper dragon, a birdhouse, a sourdough loaf"/><button className="primary-action search-button" onClick={() => void runSearch()} disabled={searching}>{searching ? <><span className="spinner"/> Finding…</> : <>Find guides <span>→</span></>}</button></div><div className="privacy-line"><span>↳</span> Search articles and videos, then choose the ones you trust before we make your guide.</div></div>}
        {activeTab === "link" && <div className="maker-content"><label className="field-label" htmlFor="tutorial-url">Paste a tutorial article or video URL</label><div className="search-row"><span className="search-icon">↗</span><input id="tutorial-url" className="search-input" value={directUrl} onChange={(event) => setDirectUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void makeFromLink(); }} placeholder="https://…"/><button className="primary-action search-button" onClick={() => void makeFromLink()} disabled={building}>{building ? "Reading…" : <>Make my guide <span>→</span></>}</button></div><div className="privacy-line">We’ll use the tutorial’s readable text or captions and show where each guide came from.</div></div>}
        {activeTab === "paste" && <div className="maker-content"><label className="field-label" htmlFor="tutorial-title">Tutorial name <span className="optional">optional</span></label><input id="tutorial-title" className="text-input title-input" value={pasteTitle} onChange={(event) => setPasteTitle(event.target.value)} placeholder="e.g. Fold a paper crane"/><label className="field-label paste-label" htmlFor="tutorial-text">Paste the article, transcript, or steps</label><textarea id="tutorial-text" className="paste-area" rows={4} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="Paste the useful bits here…"/><button className="primary-action paste-button" onClick={() => void makeFromPaste()} disabled={building}>{building ? "Making your guide…" : <>Turn into steps <span>→</span></>}</button></div>}
        {error && !guide && <p className="error-note home-error" role="alert">{error}</p>}
      </section>
      {searchDone && activeTab === "discover" && <section className="results-section"><div className="results-heading"><div><span className="eyebrow">YOUR RESEARCH</span><h2>{hits.length ? `A few good places to start` : "No tutorials yet"}</h2></div>{hits.length > 0 && <span className="results-count">{hits.length} sources found</span>}</div>{hits.length > 0 ? <><div className="result-columns"><div className="result-group"><div className="group-label"><span>↗</span> ARTICLES <small>{articles.length}</small></div>{articles.map((hit) => <SourceCard key={hit.id} hit={hit} selected={selected.includes(hit.id)} onToggle={() => setSelected((current) => current.includes(hit.id) ? current.filter((id) => id !== hit.id) : [...current, hit.id])}/>)}</div><div className="result-group"><div className="group-label"><span>▶</span> VIDEOS <small>{videos.length}</small></div>{videos.map((hit) => <SourceCard key={hit.id} hit={hit} selected={selected.includes(hit.id)} onToggle={() => setSelected((current) => current.includes(hit.id) ? current.filter((id) => id !== hit.id) : [...current, hit.id])}/>)}</div></div><div className="build-bar"><span>{selected.length} source{selected.length === 1 ? "" : "s"} selected · reviewed by you</span><button className="primary-action" onClick={() => void makeGuide()} disabled={building || selected.length === 0}>{building ? "Reading sources…" : <>Build my step-by-step guide <span>→</span></>}</button></div></> : <p className="empty-results">Try a shorter search, paste a link, or pick a paper project below.</p>}</section>}
      {!searchDone && <section className="paper-section"><div className="section-heading"><div><span className="eyebrow">START WITH A SHEET OF PAPER</span><h2>Little folds. Lovely results.</h2></div><span className="section-aside">No tools. Just a square sheet.</span></div><div className="paper-grid">{PAPER_STARTERS.map((item) => <button className={`paper-card ${item.tone}`} key={item.id} onClick={() => void startWithPaper(item.id)} disabled={building}><span className="paper-icon">{item.icon}</span><span className="paper-card-title">{item.title}</span><span className="paper-card-detail">{item.detail}</span><span className="paper-card-arrow">↗</span></button>)}</div></section>}
      <footer className="site-footer"><span>step by step <span className="footer-dot">·</span> made for curious hands</span><span>Sources stay visible. Safety notes come first.</span></footer>
    </main>
  );
}

function SourceCard({ hit, selected, onToggle }: { hit: SearchHit; selected: boolean; onToggle: () => void }) {
  return <article className={selected ? "source-card selected" : "source-card"}><button className="source-select" onClick={onToggle} aria-label={`${selected ? "Remove" : "Add"} ${hit.title}`} aria-pressed={selected}><span>{selected ? "✓" : "+"}</span></button><div className="source-copy"><div className="source-meta">{hit.kind === "video" ? "VIDEO" : "ARTICLE"}<span>·</span>{hostLabel(hit.url)}</div><a className="source-title" href={hit.url} target="_blank" rel="noreferrer">{hit.title}</a>{hit.snippet && <p>{hit.snippet}</p>}</div><a className="source-open" href={hit.url} target="_blank" rel="noreferrer" aria-label={`Open ${hit.title}`}>↗</a></article>;
}

function hostLabel(raw: string): string {
  try { return new URL(raw).hostname.replace(/^www\./, ""); } catch { return "source"; }
}
