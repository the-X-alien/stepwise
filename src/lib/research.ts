import { isIP } from "node:net";
import type { GuideSource } from "./types";
import type { ResearchMaterial } from "./groq";
import { htmlToText } from "./html-text";

export interface SearchHit {
  id: string;
  title: string;
  url: string;
  kind: "article" | "video";
  snippet: string;
}

export interface SearchBundle {
  query: string;
  hits: SearchHit[];
  materials: ResearchMaterial[];
  warnings: string[];
}

const MAX_PAGE_CHARS = 12_000;
const MAX_RESULTS_PER_TYPE = 5;
const USER_AGENT =
  "Mozilla/5.0 (compatible; Proofline/1.0; +https://github.com/proofline) AppleWebKit/537.36 Chrome/124 Safari/537.36";

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
}

function cleanText(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim();
}

function hostIsPrivate(host: string): boolean {
  const name = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    name === "localhost" ||
    name.endsWith(".localhost") ||
    name.endsWith(".local") ||
    name === "metadata.google.internal"
  ) return true;
  const version = isIP(name);
  if (version === 4) {
    const [a, b] = name.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a! >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b! >= 16 && b! <= 31) ||
      (a === 192 && b === 168);
  }
  if (version === 6) {
    return name === "::1" || name === "::" || name.startsWith("fe80:") ||
      name.startsWith("fc") || name.startsWith("fd") || name.startsWith("::ffff:127.");
  }
  return false;
}

export function validatePublicHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (!(["http:", "https:"].includes(url.protocol))) return null;
    if (url.username || url.password || hostIsPrivate(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

async function fetchPublicText(rawUrl: string, timeoutMs = 9000): Promise<{ text: string; finalUrl: string; contentType: string } | null> {
  let url = validatePublicHttpUrl(rawUrl);
  if (!url) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Redirects are checked manually to prevent a public URL redirecting the
    // server into localhost/private network space.
    let response: Response | null = null;
    for (let redirects = 0; redirects <= 3; redirects++) {
      response = await fetch(url, {
        signal: controller.signal,
        redirect: "manual",
        headers: { "user-agent": USER_AGENT, accept: "text/html,text/plain,application/json;q=0.8,*/*;q=0.5" },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects === 3) return null;
        const next = validatePublicHttpUrl(new URL(location, url).toString());
        if (!next) return null;
        url = next;
        continue;
      }
      break;
    }
    if (!response?.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!/(text\/html|text\/plain|application\/json|xml)/i.test(contentType)) return null;
    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < 2_000_000) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      const chunk = value.subarray(0, 2_000_000 - total);
      chunks.push(chunk);
      total += chunk.byteLength;
      if (total >= 2_000_000) break;
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { text: new TextDecoder().decode(bytes), finalUrl: url.toString(), contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function decodeDuckDuckGoUrl(href: string): string | null {
  try {
    const absolute = href.startsWith("//") ? `https:${href}` : href;
    const wrapper = new URL(absolute, "https://duckduckgo.com");
    const target = wrapper.searchParams.get("uddg");
    return target ?? (wrapper.hostname !== "duckduckgo.com" ? wrapper.toString() : null);
  } catch {
    return null;
  }
}

export function parseDuckDuckGoResults(html: string, max = MAX_RESULTS_PER_TYPE): SearchHit[] {
  const hits: SearchHit[] = [];
  const blocks = html.split(/<div\b[^>]*class=["'][^"']*result\b[^"']*["'][^>]*>/i).slice(1);
  for (const block of blocks) {
    if (hits.length >= max) break;
    const link = /<a\b[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(block);
    if (!link) continue;
    const url = decodeDuckDuckGoUrl(link[1]!);
    const title = cleanText(link[2]!);
    if (!url || !title || !validatePublicHttpUrl(url)) continue;
    const snippetMatch = /class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)(?:<\/div>|<\/a>)/i.exec(block);
    const snippet = snippetMatch ? cleanText(snippetMatch[1]!) : "";
    hits.push({ id: `article-${hits.length + 1}`, title, url, kind: "article", snippet });
  }
  return hits;
}

function findJsonAssignment(html: string, marker: string): unknown | null {
  const index = html.indexOf(marker);
  if (index < 0) return null;
  const start = html.indexOf("{", index + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i]!;
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

function textFromRenderer(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const obj = value as { simpleText?: unknown; runs?: Array<{ text?: unknown }> };
  if (typeof obj.simpleText === "string") return obj.simpleText;
  return Array.isArray(obj.runs) ? obj.runs.map((r) => typeof r.text === "string" ? r.text : "").join("") : "";
}

function collectVideoRenderers(value: unknown, out: Record<string, unknown>[], limit: number): void {
  if (out.length >= limit || !value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const child of value) collectVideoRenderers(child, out, limit);
    return;
  }
  const obj = value as Record<string, unknown>;
  if (obj.videoRenderer && typeof obj.videoRenderer === "object") {
    out.push(obj.videoRenderer as Record<string, unknown>);
  }
  for (const child of Object.values(obj)) collectVideoRenderers(child, out, limit);
}

export function parseYouTubeSearchResults(html: string, max = MAX_RESULTS_PER_TYPE): SearchHit[] {
  const data = findJsonAssignment(html, "ytInitialData =");
  if (!data) return [];
  const renderers: Record<string, unknown>[] = [];
  collectVideoRenderers(data, renderers, max);
  return renderers.flatMap((renderer, index) => {
    const id = typeof renderer.videoId === "string" ? renderer.videoId : "";
    const title = textFromRenderer(renderer.title);
    const snippet = [textFromRenderer(renderer.descriptionSnippet), textFromRenderer(renderer.lengthText)].filter(Boolean).join(" · ");
    if (!id || !title) return [];
    return [{ id: `video-${index + 1}`, title, url: `https://www.youtube.com/watch?v=${id}`, kind: "video" as const, snippet }];
  });
}

function youtubeVideoId(url: URL): string | null {
  if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
  if (url.hostname.endsWith("youtube.com")) {
    if (url.pathname === "/watch") return url.searchParams.get("v");
    const match = /^\/(?:shorts|embed|live)\/([^/]+)/.exec(url.pathname);
    return match?.[1] ?? null;
  }
  return null;
}

function extractArticle(html: string): { title: string; text: string } {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "Tutorial";
  const description = /<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([^"']*)["'][^>]*>/i.exec(html)?.[1] ?? "";
  // Prefer semantic article/main, otherwise strip boilerplate from the body.
  const semantic = /<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/i.exec(html)?.[1] ?? html;
  const body = htmlToText(semantic).replace(/\s+/g, " ").trim();
  return { title: cleanText(title).slice(0, 200), text: `${decodeEntities(description)}\n\n${body}`.slice(0, MAX_PAGE_CHARS) };
}

function extractTranscriptUrl(player: unknown): { title: string; description: string; captionsUrl: string | null } {
  if (!player || typeof player !== "object") return { title: "Video tutorial", description: "", captionsUrl: null };
  const root = player as Record<string, unknown>;
  const details = (root.videoDetails && typeof root.videoDetails === "object" ? root.videoDetails : {}) as Record<string, unknown>;
  const captions = (root.captions && typeof root.captions === "object" ? root.captions : {}) as Record<string, unknown>;
  const renderer = (captions.playerCaptionsTracklistRenderer && typeof captions.playerCaptionsTracklistRenderer === "object" ? captions.playerCaptionsTracklistRenderer : {}) as Record<string, unknown>;
  const tracks = Array.isArray(renderer.captionTracks) ? renderer.captionTracks as Array<Record<string, unknown>> : [];
  const track = tracks.find((candidate) => typeof candidate.baseUrl === "string" && /en/i.test(String(candidate.languageCode ?? ""))) ?? tracks[0];
  const title = typeof details.title === "string" ? details.title : "Video tutorial";
  const description = typeof details.shortDescription === "string" ? details.shortDescription : "";
  const captionsUrl = typeof track?.baseUrl === "string" ? `${track.baseUrl}&fmt=json3` : null;
  return { title, description, captionsUrl };
}

function transcriptJsonToText(raw: string): string {
  try {
    const data = JSON.parse(raw) as { events?: Array<{ segs?: Array<{ utf8?: string }> }> };
    return (data.events ?? []).flatMap((event) => event.segs ?? []).map((seg) => seg.utf8 ?? "").join(" ").replace(/\s+/g, " ").trim();
  } catch {
    return cleanText(raw);
  }
}

export async function extractDirectTutorial(urlString: string): Promise<{ material: ResearchMaterial | null; reason?: string }> {
  const url = validatePublicHttpUrl(urlString);
  if (!url) return { material: null, reason: "Use a public http(s) tutorial link; private or local URLs are not fetched." };

  if (youtubeVideoId(url)) {
    const page = await fetchPublicText(url.toString(), 14_000);
    if (!page) return { material: null, reason: "Could not load that video page." };
    const player = findJsonAssignment(page.text, "ytInitialPlayerResponse =");
    const video = extractTranscriptUrl(player);
    let transcript = "";
    if (video.captionsUrl) {
      const captionData = await fetchPublicText(video.captionsUrl, 10_000);
      if (captionData) transcript = transcriptJsonToText(captionData.text);
    }
    const content = [video.description, transcript].filter(Boolean).join("\n\n").slice(0, MAX_PAGE_CHARS);
    if (content.length < 60) {
      return {
        material: null,
        reason: "This video has no public captions available; paste its transcript or choose a video with captions.",
      };
    }
    return { material: { id: "source-1", title: video.title, url: page.finalUrl, kind: "video", text: content } };
  }

  const page = await fetchPublicText(url.toString());
  if (!page) return { material: null, reason: "Could not fetch that page. Try another public tutorial or paste its text." };
  const article = extractArticle(page.text);
  if (article.text.length < 60) return { material: null, reason: "The page did not contain enough readable tutorial text." };
  return { material: { id: "source-1", title: article.title, url: page.finalUrl, kind: "article", text: article.text } };
}

export async function searchWebAndVideos(
  query: string,
  extractContent = true,
): Promise<SearchBundle> {
  const q = query.trim();
  if (q.length < 3) return { query: q, hits: [], materials: [], warnings: ["Enter a task to search for."] };
  const webUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${q} tutorial steps`)}`;
  const videoUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${q} tutorial`)}`;
  const [webPage, videoPage] = await Promise.all([
    fetchPublicText(webUrl, 12_000),
    fetchPublicText(videoUrl, 12_000),
  ]);
  const webHits = webPage ? parseDuckDuckGoResults(webPage.text, MAX_RESULTS_PER_TYPE) : [];
  const videoHits = videoPage ? parseYouTubeSearchResults(videoPage.text, MAX_RESULTS_PER_TYPE) : [];
  const hits = [...webHits, ...videoHits];
  const warnings: string[] = [];
  if (!webPage) warnings.push("Web article search was unavailable just now.");
  if (!videoPage) warnings.push("Video search was unavailable just now.");
  if (hits.length === 0) return { query: q, hits, materials: [], warnings: [...warnings, "No search results were readable. Paste a tutorial link or text instead."] };
  if (!extractContent) return { query: q, hits, materials: [], warnings };

  const materials = await extractSelectedSources(hits.slice(0, 6));
  return { query: q, hits, materials, warnings };
}

export async function extractSelectedSources(hits: SearchHit[]): Promise<ResearchMaterial[]> {
  const selected = hits.slice(0, 6);
  const extracted = await Promise.all(selected.map(async (hit) => {
    const result = await extractDirectTutorial(hit.url);
    if (!result.material) return null;
    return { ...result.material, id: hit.id, title: result.material.title || hit.title, kind: hit.kind };
  }));
  return extracted.filter((item) => item !== null) as ResearchMaterial[];
}

export function publicSources(materials: ResearchMaterial[]): GuideSource[] {
  return materials.map(({ id, title, url, kind }) => ({ id, title, url, kind }));
}
