"""Fresh-user demo walkthrough, no AI: guide -> check steps -> reload (persist) -> 3D preview -> Next to Finish -> Replay/Back -> Finish returns to the same guide with checks intact.
Needs the app server on :8770 and Chrome. Simulation/preview only, no camera."""
import os, sys
from playwright.sync_api import sync_playwright
fails = []
def check(n, c, x=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else " " + str(x)))
    if not c: fails.append(n)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_context(viewport={"width": 430, "height": 900}).new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://localhost:8770/"); pg.wait_for_selector(".chip")
    check("no AI by default", "No AI model connected" in pg.inner_text("body"))
    pg.click("[data-id=airplane]"); check("warnings first, 6 steps", "Before you start" in pg.inner_text("body") and pg.locator(".step").count() == 6)
    bx = pg.locator(".step input[type=checkbox]"); bx.nth(0).check(); bx.nth(1).check()
    pg.reload(); pg.wait_for_selector(".chip"); pg.click("[data-id=airplane]")
    check("checks persist after reload", pg.locator(".step input[type=checkbox]:checked").count() == 2)
    pg.click("button:has-text('3D fold preview')"); pg.wait_for_timeout(2500)
    check("preview page opened", "ar.html" in pg.url and "demo=1" in pg.url, pg.url)
    seen = []
    for _ in range(8):
        seen.append(pg.inner_text("#st"))
        if pg.inner_text("#nx") == "Finish": break
        pg.click("#nx"); pg.wait_for_timeout(700)
    check("reaches last step (Finish)", pg.inner_text("#nx") == "Finish" and seen[-1].startswith("6/6") and len(seen) >= 2, seen)  # preview opens at the first unchecked step (3/6 here)
    pg.click("#rp"); pg.wait_for_timeout(500); check("replay keeps the step", pg.inner_text("#st") == seen[-1])
    pg.click("#back"); pg.wait_for_timeout(500); check("back goes to previous step", pg.inner_text("#st") == seen[-2])
    pg.click("#nx"); pg.wait_for_timeout(500); pg.click("#nx"); pg.wait_for_timeout(1500)
    check("Finish returns to the same guide with checks intact", pg.url.endswith("index.html#airplane") and pg.locator(".step").count() == 6 and pg.locator(".step input[type=checkbox]:checked").count() == 2, pg.url)
    check("no JS errors", not errs, errs)
print("FAILED:" if fails else "ALL PASS", fails); sys.exit(1 if fails else 0)
