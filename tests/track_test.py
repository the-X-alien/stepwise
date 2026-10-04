# Marker-tracking check with a SYNTHETIC moving-marker video (ffmpeg). Make it first:
#  ffmpeg -f lavfi -i color=white:s=640x480:r=15:d=4 -i hiro.jpg -filter_complex "[1:v]scale=240:240,rotate=0.6*t:c=white:ow=340:oh=340[m];[0:v][m]overlay=x=60+130*t:y=60+20*t" -pix_fmt yuv420p /tmp/move.y4m
# Not a real phone camera.
import time
from playwright.sync_api import sync_playwright
from PIL import Image
import numpy as np
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox","--use-gl=swiftshader","--enable-unsafe-swiftshader","--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream","--use-file-for-fake-video-capture=/tmp/move.y4m"])
    pg=b.new_page(viewport={"width":480,"height":640});pg.goto("http://localhost:8770/ar.html?preset=airplane&step=1&k=1")
    pg.wait_for_function("document.getElementById('stat').textContent.includes('Marker found')",timeout=40000)
    pts=[]
    for i in range(4):
        pg.screenshot(path=f"/tmp/t{i}.png");time.sleep(0.7)
        a=np.array(Image.open(f"/tmp/t{i}.png").convert("RGB")).astype(int)[60:480]
        yel=(a[:,:,0]>230)&(a[:,:,1]>190)&(a[:,:,1]<235)&(a[:,:,2]<140)
        blk=(a.sum(axis=2)<60)
        c=lambda m:(round(np.nonzero(m)[1].mean()),round(np.nonzero(m)[0].mean()),int(m.sum())) if m.sum()>50 else None
        pts.append((c(yel),c(blk)));print(i,"model(yellow) centroid,px:",c(yel),"| marker(black) centroid,px:",c(blk))
    b.close()
