# Stepwise (working title)

Learn any hands-on task one checked step at a time. Paste a tutorial link or type a topic. Paper projects are today's demo content only: nothing in the data model or pipeline is paper-specific.

Windows: see WINDOWS.md (untested on Windows). Marker without a printer: static/marker.html (show on a phone, or hand-draw).

## Run (Python 3.10+)
    pip install -r requirements.txt     # or requirements-min.txt (no trafilatura)
    python3 server.py          # open http://localhost:8765
Optional AI: any OpenAI-compatible endpoint you are allowed to use, configured in your own shell (never paste keys into chat):
    STEPWISE_LLM_BASE_URL=https://.../v1 STEPWISE_LLM_KEY=... STEPWISE_LLM_MODEL=... python3 server.py
Not needed: without it, links with schema.org HowTo markup (wikiHow, Instructables, many recipe/DIY sites) still give clean steps; other pages fall back to rule-based extraction.
Plan B (no pip): python3 -m http.server 8765 --directory static  -> built-in guides + AR only (tests/planb_test.py).

## What it does
1. Input: a link, or a topic. Topic = autonomous loop: search (DuckDuckGo, Bing fallback; plus a wikiHow-targeted query) -> fetch up to 4 candidates -> extract steps -> reject off-topic / bot-wall / too-short pages -> score -> choose, with the whole action trace visible.
2. Extraction order: schema.org HowTo/Recipe markup (steps, sections, supplies) -> LLM structuring if configured -> rule-based imperative-sentence extraction.
3. Each step is matched to its best source passage ("Where this comes from"). "I'm stuck" retrieves cited passages from the source; an AI answer is added only if an LLM is configured.
4. Safety: warnings first; keyword-based high-risk banner (electrical, gas, chemicals, sharp/hot tools, medical, lithium); retrieval-only answers are labelled.
5. Materials-on-hand check (plain text match), per-step checkmarks with progress, saved in the browser.
6. AR guide (static/ar.html): A-Frame + AR.js Hiro marker. Shows the current step's text card and, for built-in paper guides, a 3D flat-fold simulation (fold.js, own code) anchored to the marker.

## Verified (see tests/)
- tests/test_core.py: 10 unit tests (extraction, grounding, retrieval, junk/off-topic rejection).
- tests/fold.test.js: 25 checks. Folded layer area equals paper area for every simulated step.
- Q&A abstains when the source doesn't cover the question (4/4 off-source questions in tests/eval_retrieval.py; 12 unit tests).
- tests/barcode_test.py: the hand-drawable marker (3x3 code 5) is detected from a synthetic feed; a real pen drawing is NOT tested.
- tests/e2e.py: 15 browser checks (Playwright + Chrome): built-in guide, checkmarks + persistence, ask, topic search -> wikiHow airplane (28 steps), instructables link (16 steps), AR page opens, marker detected, Next works.
- tests/track_test.py: model follows a MOVING synthetic marker (centroid of model moved 199 -> 266 -> 333 -> 382 px while the marker moved).
- tests/eval_retrieval.py: 10 self-written Q&A cases on saved real pages: top-1 7/10, top-3 8/10. Small, not independent.

## NOT verified / limits (read this)
- AR was verified with a SYNTHETIC camera feed in headless Chrome (ffmpeg video of the Hiro marker), not a real phone camera. A phone needs HTTPS (a laptop uses localhost). Print or display the Hiro marker: https://jeromeetienne.github.io/AR.js/data/images/HIRO.jpg
- AR tracks the marker, not your paper, and cannot check your folds. 3D fold simulation exists only for the first folds of airplane (4/6 steps), boat (3/7), crane (2/10), cup (3/5); it is idealized flat-fold geometry, not checked against every real-world variation. Other steps are text only and the view says so. Non-paper tasks (shoelaces, coffee, web tutorials) get the marker + text card only, no 3D.
- Web search: DuckDuckGo showed a bot challenge from the build sandbox; the Bing fallback worked there. Either engine can block or change markup at any time.
- Video links need captions; no video understanding. Rule-based extraction (pages without HowTo markup) is noisy.
- No AI model was connected in any test, so free-text answers are retrieval-only. AI paths (structuring, answers) are untested live.
- Built-in guides are hand-written standard origami and everyday steps, labelled as such.
- Multi-method pages (wikiHow "4 ways") are shown with a section badge but all methods are in one list.

## Node0 AR reference (shlok-madhekar/los-altos-proj)
Public repo, no LICENSE file: default copyright, no permission to copy. Its AR uses public libraries (A-Frame + AR.js Hiro marker, @react-three/xr hit-test, iOS Quick Look USDZ) and a "cumulative stages with the current step highlighted" idea. This project uses the same public libraries and the same general idea, with its own code. No Node0 code is included.

## What the checks mean (read this)
- "Steps matched to source text" is a word-overlap match between each step and the best sentence in the source. It is not a check that the step is correct or safe.
- With an AI model connected (STEPWISE_LLM_*), steps the model wrote that the source text does not support are removed and listed under "Removed: not found in the source". This is the same word-overlap test, so it can miss a wrong step that reuses source words. Tested only against a stub model; a real local model smoke test is separate (tests/real_llm_smoke.py).
- Video links: if no captions can be read, the steps come from the video's title and description only, and the app says so.
- Device check: open /check.html to see what your browser reports for camera, WebXR and AR Quick Look. Stepwise has no WebXR view yet.

## Experimental WebXR view (not device-tested)
`/xr.html?preset=airplane&step=0` places the fold model on a surface using WebXR hit-test, only where the browser reports `immersive-ar` support and the page is on HTTPS or localhost. Otherwise it explains why and links to the marker AR page and to a no-AR 3D preview (`&demo=1`). The builder has not run it on a physical device. `tests/xr_guard_test.py` checks only the capability guard with a mocked support flag. caniuse reports no WebXR on iOS Safari, so iPhones will land on the fallback.

## Repo note
The two marker images (hiro.jpg, barcode5.png) are embedded as data URIs inside static/marker.html because this repo was uploaded as text files only. tests/barcode_test.py and tests/track_test.py only mention those filenames in comments (their feeds are prebuilt); regenerating the feeds needs the images, which can be saved from marker.html.
