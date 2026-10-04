import { describe, expect, it } from "vitest";
import { parseDuckDuckGoResults, parseYouTubeSearchResults, validatePublicHttpUrl } from "@/lib/research";

describe("validatePublicHttpUrl", () => {
  it("accepts public https URLs", () => {
    expect(validatePublicHttpUrl("https://example.com/guide")?.hostname).toBe("example.com");
  });
  it("rejects non-web, localhost, and private-network URLs", () => {
    expect(validatePublicHttpUrl("file:///etc/passwd")).toBeNull();
    expect(validatePublicHttpUrl("http://localhost/admin")).toBeNull();
    expect(validatePublicHttpUrl("http://127.0.0.1:3000")).toBeNull();
    expect(validatePublicHttpUrl("http://192.168.1.1")).toBeNull();
    expect(validatePublicHttpUrl("https://user:pass@example.com")).toBeNull();
  });
});

describe("parseDuckDuckGoResults", () => {
  it("extracts title, snippet and unwrapped result URL", () => {
    const html = `<div class="result results_links results_links_deep">
      <h2><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Forigami.me%2Fcrane%2F&amp;rut=xx">How to Fold a Crane</a></h2>
      <div class="result__snippet">Clear <b>step by step</b> instructions for beginners.</div>
    </div>`;
    const hits = parseDuckDuckGoResults(html);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ title: "How to Fold a Crane", url: "https://origami.me/crane/", kind: "article" });
    expect(hits[0]!.snippet).toContain("step by step");
  });
  it("rejects duckduckgo links without a target", () => {
    expect(parseDuckDuckGoResults(`<div class="result"><a class="result__a" href="/about">About</a></div>`)).toEqual([]);
  });
});

describe("parseYouTubeSearchResults", () => {
  it("extracts video renderers from initial data", () => {
    const data = { contents: { videoRenderer: { videoId: "abc123", title: { runs: [{ text: "Origami frog tutorial" }] }, descriptionSnippet: { simpleText: "Fold a jumping frog" }, lengthText: { simpleText: "8:12" } } } };
    const html = `var ytInitialData = ${JSON.stringify(data)};</script>`;
    const hits = parseYouTubeSearchResults(html);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ title: "Origami frog tutorial", url: "https://www.youtube.com/watch?v=abc123", kind: "video" });
    expect(hits[0]!.snippet).toContain("8:12");
  });
  it("returns empty when page data is missing", () => {
    expect(parseYouTubeSearchResults("<html>blocked</html>")).toEqual([]);
  });
});