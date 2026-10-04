# Hand-drawable marker (AR.js 3x3 code 5) detected from a SYNTHETIC feed. Make feed: composite static/barcode5.png (300px) on a 640x480 white frame, ffmpeg -> /tmp/bc.y4m
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-file-for-fake-video-capture=/tmp/bc.y4m"])
    pg = b.new_page(viewport={"width": 480, "height": 640}); pg.goto("http://localhost:8770/ar.html?preset=airplane&step=1&m=barcode")
    pg.wait_for_function("document.getElementById('stat').textContent.includes('Marker found')", timeout=30000); print("PASS barcode marker found (synthetic)"); b.close()
