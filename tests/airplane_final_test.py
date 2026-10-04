"""Airplane steps 5-6 render (hand-drawn finished-shape model, not the fold simulator). Needs app server on :8770 and Chrome. Visual check = screenshots, this checks no errors and the honest label."""
import os, sys
from playwright.sync_api import sync_playwright
fails = []
def check(n, c, x=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else " " + str(x)))
    if not c: fails.append(n)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    for step, k in [(4, "0"), (4, "1"), (5, "1")]:
        pg = b.new_page(viewport={"width": 430, "height": 800}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://localhost:8770/ar.html?preset=airplane&step=%d&demo=1&k=%s" % (step, k)); pg.wait_for_timeout(2500)
        n = pg.evaluate("document.querySelector('[paper]').object3D.children[0].children.length")
        check("step %d k=%s: no JS errors, model built" % (step + 1, k), not errs and n >= 2, (errs, n))
        check("step %d: label says finished shape is hand-drawn, not simulation" % (step + 1), "not a fold simulation" in pg.inner_text("#sn"), pg.inner_text("#sn"))
    pg = b.new_page(viewport={"width": 430, "height": 800}); pg.goto("http://localhost:8770/ar.html?preset=airplane&step=3&demo=1&k=1"); pg.wait_for_timeout(2000)
    check("step 4 still uses the fold simulator label", "flat-fold simulation" in pg.inner_text("#sn"))
print("FAILED:" if fails else "ALL PASS", fails); sys.exit(1 if fails else 0)
