# Plan B: no pip, no server.py. python -m http.server serves static/ (built-in guides + AR only).
import subprocess, time, sys
from playwright.sync_api import sync_playwright
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8790", "--directory", "static", "--bind", "127.0.0.1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-file-for-fake-video-capture=/tmp/hiro.y4m"])
        pg = b.new_page(viewport={"width": 420, "height": 900}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://localhost:8790/"); pg.wait_for_selector(".chip"); pg.click("[data-id=crane]")
        assert pg.locator(".step").count() == 10; print("PASS planB: built-in crane guide, 10 steps")
        assert "Offline mode" in pg.inner_text("#status"); print("PASS planB: says offline mode")
        pg.click("button:has-text('AR guide')"); pg.wait_for_url("**/ar.html"); pg.wait_for_function("document.getElementById('stat').textContent.includes('Marker found')", timeout=40000); print("PASS planB: AR marker found (synthetic)")
        assert not errs; print("PASS planB: no page errors"); b.close()
finally: srv.terminate()
