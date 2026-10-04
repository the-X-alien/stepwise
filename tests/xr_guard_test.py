"""Guard tests for static/xr.html (experimental WebXR page). Needs the app server on :8770 and Chrome (CHROME env or /usr/bin/google-chrome).
Checks the capability guard and that no 3D scene content is shown before a WebXR session. A MOCKED support flag only exercises the guard.
It does NOT test real WebXR, hit-test placement or any device."""
import os, sys
from playwright.sync_api import sync_playwright
U = "http://localhost:8770/xr.html?preset=airplane&step=1"; fails = []
def check(n, c, x=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else " " + str(x)))
    if not c: fails.append(n)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    def page(url, init=None, shot=None):
        pg = b.new_page(viewport={"width": 420, "height": 760}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        if init: pg.add_init_script(init)
        pg.goto(url); pg.wait_for_timeout(3500)
        if shot: pg.screenshot(path=shot)
        return pg, errs
    vis = "document.getElementById('anchor').object3D.visible"
    pg, e = page(U, "", "/downloads/xr_unsupported.png")
    t = pg.inner_text("#top")
    check("unsupported: explains and offers marker AR + preview links", "does not report immersive-ar" in t and pg.locator("#top a[href='ar.html']").count() == 1 and pg.locator("#top a[href*='demo=1']").count() == 1, t)
    check("unsupported: no Start button", pg.locator("#go").count() == 0)
    check("unsupported: 3D content hidden before a session", pg.evaluate(vis) is False, pg.evaluate(vis))
    check("unsupported: no JS errors", not e, e)
    pg, e = page(U, "navigator.xr&&(navigator.xr.isSessionSupported=async m=>m=='immersive-ar')", "/downloads/xr_mock_supported.png")
    check("mock-supported: Start button + untested caveat", pg.locator("#go").count() == 1 and "Not tested on a physical device" in pg.inner_text("#top"))
    check("mock-supported: 3D content still hidden before Start", pg.evaluate(vis) is False)
    check("mock-supported: no JS errors", not e, e)
    pg.evaluate("document.querySelector('a-scene').emit('enter-vr')"); pg.wait_for_timeout(300)
    check("content shown after enter-vr event (simulated event only)", pg.evaluate(vis) is True)
    pg, e = page("http://localhost:8770/xr.html?preset=airplane&step=1&demo=1&k=0.5", None, "/downloads/xr_demo.png")
    check("demo preview: labeled Not AR, content visible", "Not AR" in pg.inner_text("#top") and pg.evaluate(vis) is True and not e, e)
    pg, e = page("http://localhost:8770/xr.html?preset=airplane&step=1", "Object.defineProperty(window,'isSecureContext',{value:false})")
    check("insecure context: says needs HTTPS", "HTTPS" in pg.inner_text("#top"), pg.inner_text("#top"))
    pg, e = page("http://localhost:8770/", None)
    pg.click("[data-id=airplane]"); pg.wait_for_timeout(300)
    check("index: experimental XR button shown for paper preset, labeled untested", pg.locator("button:has-text('Surface AR (experimental, untested on devices)')").count() == 1)
    pg.click("button:has-text('Surface AR')"); pg.wait_for_timeout(3500)
    check("XR button opens xr.html with the guide's steps and the guard message", "xr.html" in pg.url and "does not report immersive-ar" in pg.inner_text("#top") and "Fold" in pg.inner_text("#hud"), pg.url)
    href = pg.locator("#top a[href*='demo=1']").get_attribute("href")
    check("preview link keeps a valid query (?demo=1)", href.startswith("?demo=1") or "&demo=1" in href, href)
    pg, e = page("http://localhost:8770/", None); pg.click("[data-id=coffee]"); pg.wait_for_timeout(300)
    check("index: no XR button for non-paper guide", pg.locator("button:has-text('Surface AR')").count() == 0)
print("FAILED:" if fails else "ALL PASS", fails); sys.exit(1 if fails else 0)
