"""Browser end-to-end checks (Playwright + system Chrome). Run server first: PORT=8770 python3 server.py
   Usage: python3 tests/e2e.py [base_url]"""
import sys, os, time, json
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8770"
HIRO = "/tmp/hiro.y4m"   # synthetic camera feed: white frame with the Hiro marker (made with ffmpeg)
res = []
def check(name, ok, note=""): res.append((name, bool(ok), note)); print(("PASS " if ok else "FAIL ") + name, note)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
        "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-file-for-fake-video-capture=" + HIRO])
    ctx = b.new_context(viewport={"width": 420, "height": 900}); pg = ctx.new_page(); logs = []
    pg.on("console", lambda m: logs.append(m.text)); pg.on("pageerror", lambda e: logs.append("PAGEERROR " + str(e)))
    pg.goto(BASE); pg.wait_for_selector(".chip")
    check("home: 6 built-in chips", pg.locator(".chip").count() == 6)
    pg.click("[data-id=airplane]")
    check("airplane: 6 step cards", pg.locator(".step").count() == 6)
    check("airplane: warnings shown before steps", pg.locator(".warn").count() == 1)
    pg.locator(".step input[type=checkbox]").first.check()
    check("progress updates to 1 of 6", "1 of 6" in pg.inner_text("#out"))
    pg.reload(); pg.wait_for_selector(".chip"); pg.click("[data-id=airplane]")
    check("checkmark persists after reload", "1 of 6" in pg.inner_text("#out"))
    pg.locator("summary:has-text('stuck')").nth(1).click(); pg.fill("#a1", "how far should the corners fold"); pg.click("#a1 + button")
    pg.wait_for_selector(".ans"); check("ask: answer box appears, labelled no-AI", "no ai" in pg.inner_text("#r1").lower() or "doesn't seem" in pg.inner_text("#r1"), pg.inner_text("#r1")[:80])
    pg.click("[data-id=coffee]"); check("coffee: hot-water warning present", "hot" in pg.inner_text(".warn").lower())
    pg.fill("#have", "coffee"); pg.press("#have", "Tab"); check("materials check reacts", "missing" in pg.inner_text("#out").lower() or "have what" in pg.inner_text("#out").lower())
    # network flows (live search + live page fetch)
    pg.fill("#q", "make a paper airplane"); pg.click("#go"); pg.wait_for_selector("text=steps matched to source", timeout=60000)
    check("topic flow: agent picked a source and built steps", pg.locator(".step").count() >= 5, "%d steps" % pg.locator(".step").count())
    check("topic flow: agent trace visible", "fetch+extract+ground" in pg.locator("details.card").first.text_content())
    pg.locator("summary:has-text('stuck')").nth(2).click(); pg.fill("#a2", "what if my paper is too thick"); pg.click("#a2 + button")
    pg.wait_for_selector("#r2 .ans"); pg.wait_for_function("!document.querySelector('#r2 .ans').textContent.includes('Thinking')")
    check("topic flow: off-source question abstains instead of echoing steps", "doesn't seem to address" in pg.inner_text("#r2"), pg.inner_text("#r2")[:100].replace("\n"," "))
    pg.screenshot(path="/downloads/e2e_topic.png", full_page=False)
    pg.fill("#q", "https://www.instructables.com/How-to-make-a-Paper-Crane-1/"); pg.click("#go"); pg.wait_for_selector("text=steps matched to source", timeout=60000)
    check("link flow: instructables crane extracted", pg.locator(".step").count() >= 10, "%d steps" % pg.locator(".step").count())
    pg.click("[data-id=airplane]"); pg.click("button:has-text('AR guide')"); pg.wait_for_url("**/ar.html")
    pg.wait_for_function("document.getElementById('stat').textContent.includes('Marker found')", timeout=40000)
    check("AR: marker detected in (synthetic) camera feed", True)
    time.sleep(2.5); pg.screenshot(path="/downloads/e2e_ar.png")
    check("AR: no page errors", not [l for l in logs if "PAGEERROR" in l], str([l for l in logs if "PAGEERROR" in l])[:200])
    pg.click("#nx"); time.sleep(1); check("AR: opens at first unchecked step (2), Next goes to 3", pg.inner_text("#st").startswith("3/"), pg.inner_text("#st"))
    b.close()
print("%d/%d passed" % (sum(r[1] for r in res), len(res)))
