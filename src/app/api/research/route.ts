import { NextResponse } from "next/server";

import { getDemoGuide, isOfflineMode } from "@/lib/demo-guides";
import { getPaperGuide } from "@/lib/paper-guides";
import { buildGuide } from "@/lib/step-engine";
import { guideFromSynthesis, synthesizeGuide, type ResearchMaterial } from "@/lib/groq";
import {
  extractDirectTutorial,
  extractSelectedSources,
  searchWebAndVideos,
  validatePublicHttpUrl,
  type SearchHit,
} from "@/lib/research";
import type { Guide } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TEXT_CHARS = 30_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function buildFromMaterials(
  query: string,
  materials: ResearchMaterial[],
): Promise<{ guide: Guide; synthesized: boolean }> {
  if (materials.length === 0) throw new Error("No readable tutorial sources found.");

  if (!isOfflineMode()) {
    const raw = await synthesizeGuide(query, materials);
    const guide = guideFromSynthesis(raw, materials, query);
    if (guide) return { guide, synthesized: true };
  }

  const combined = materials.map((item) => item.text).join("\n\n");
  const guide = buildGuide(combined, {
    source: { kind: "url", ref: materials[0]?.url ?? query },
    title: materials[0]?.title || query,
  });
  guide.sources = materials.map(({ id, title, url, kind }) => ({ id, title, url, kind }));
  if (guide.steps.length < 2) {
    throw new Error(
      "I found the source, but couldn't extract enough numbered steps. Pick another result or paste the tutorial text.",
    );
  }
  return { guide, synthesized: false };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isObject(body)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const action = typeof body.action === "string" ? body.action : "search";

  if (action === "demo") {
    const id = typeof body.demoId === "string" ? body.demoId : "";
    const guide = getDemoGuide(id) ?? getPaperGuide(id);
    if (!guide) return NextResponse.json({ error: "Unknown demo guide" }, { status: 404 });
    return NextResponse.json({ guide, synthesized: false, offline: isOfflineMode() });
  }

  if (action === "search") {
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (query.length < 3 || query.length > 240) {
      return NextResponse.json({ error: "Enter a task (3–240 characters) to search for." }, { status: 400 });
    }
    const bundle = await searchWebAndVideos(query, false);
    return NextResponse.json({ ...bundle, offline: isOfflineMode() });
  }

  if (action === "direct") {
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url || url.length > 2000) return NextResponse.json({ error: "Paste a public tutorial URL." }, { status: 400 });
    const result = await extractDirectTutorial(url);
    if (result.reason?.includes("no public captions")) {
      return NextResponse.json({ error: `${result.reason} Paste the transcript or pick a video with captions.` }, { status: 422 });
    }
    if (!result.material) {
      return NextResponse.json({ error: result.reason ?? "Couldn't read that tutorial." }, { status: 422 });
    }
    try {
      const built = await buildFromMaterials(result.material.title, [result.material]);
      return NextResponse.json({ ...built, offline: isOfflineMode(), warnings: result.reason ? [result.reason] : [] });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Could not make a guide." }, { status: 422 });
    }
  }

  if (action === "build") {
    const query = typeof body.query === "string" ? body.query.trim() : "your project";
    const rawHits = Array.isArray(body.sources) ? body.sources : [];
    const hits: SearchHit[] = rawHits.flatMap((entry: unknown, index: number): SearchHit[] => {
      if (!isObject(entry)) return [];
      const title = typeof entry.title === "string" ? entry.title.slice(0, 200) : "";
      const url = typeof entry.url === "string" ? entry.url : "";
      const validated = url ? validatePublicHttpUrl(url) : null;
      if (!title || !validated) return [];
      const isVideo = entry.kind === "video";
      return [{ id: typeof entry.id === "string" ? entry.id : `source-${index + 1}`, title, url: validated.toString(), kind: isVideo ? "video" : "article", snippet: "" }];
    }).slice(0, 6);
    if (hits.length === 0) return NextResponse.json({ error: "Choose at least one article or video result." }, { status: 400 });

    const materials = await extractSelectedSources(hits);
    if (materials.length === 0) return NextResponse.json({ error: "Couldn't read those sources. Try another result or paste a tutorial link." }, { status: 422 });
    try {
      const built = await buildFromMaterials(query, materials);
      return NextResponse.json({ ...built, offline: isOfflineMode(), warnings: [] });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Could not make a guide." }, { status: 422 });
    }
  }

  if (action === "paste") {
    const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT_CHARS) : "";
    if (text.length < 30) return NextResponse.json({ error: "Paste at least a few lines of a tutorial." }, { status: 400 });
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "Pasted tutorial";
    const material: ResearchMaterial = { id: "pasted-1", title, url: "", kind: "text", text };
    try {
      const built = await buildFromMaterials(title, [material]);
      if (built.guide.source) built.guide.source = { kind: "text", ref: title };
      return NextResponse.json({ ...built, offline: isOfflineMode(), warnings: [] });
    } catch {
      const guide = buildGuide(text, { source: { kind: "text", ref: title }, title });
      if (guide.steps.length < 2) return NextResponse.json({ error: "I couldn't find multiple actionable steps in that text." }, { status: 422 });
      return NextResponse.json({ guide, synthesized: false, offline: isOfflineMode(), warnings: ["AI synthesis was unavailable; showing steps extracted directly from your text."] });
    }
  }

  return NextResponse.json({ error: "Unknown action. Use search, build, direct, paste, or demo." }, { status: 400 });
}