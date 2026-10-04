"""Smoke test for a BUILT binary: python packaging/smoke.py <path-to-binary>. Starts it without opening a browser, checks it serves the bundled app, then stops it."""
import os, subprocess, sys, time, urllib.request
exe = sys.argv[1]; port = "18765"
env = dict(os.environ, PORT=port, STEPWISE_NO_BROWSER="1")
p = subprocess.Popen([exe], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
def get(path):
    return urllib.request.urlopen("http://127.0.0.1:%s%s" % (port, path), timeout=5)
ok = True
try:
    for _ in range(60):
        try: get("/api/status"); break
        except Exception: time.sleep(1)
    else: raise SystemExit("FAIL: binary never answered /api/status")
    checks = [("/api/status", b"ai"), ("/", b"Stepwise"), ("/presets.js", b"airplane"), ("/fold.js", b"FOLD"), ("/ar.html", b"AR guide"), ("/xr.html", b"WebXR"), ("/marker.html", b"markers")]
    for path, needle in checks:
        body = get(path).read(); good = needle in body
        print(("PASS " if good else "FAIL ") + path, len(body), "bytes"); ok &= good
    import json
    r = urllib.request.Request("http://127.0.0.1:%s/api/ask" % port, json.dumps({"question": "how do I fold the top corners", "step": "", "context": "Fold the top corners down to the center crease. Fold the paper in half."}).encode(), {"Content-Type": "application/json"})
    a = json.load(urllib.request.urlopen(r, timeout=10)); good = "answer" in a and a.get("ai") is False
    print(("PASS " if good else "FAIL ") + "/api/ask retrieval", a.get("abstained")); ok &= good
finally:
    p.terminate()
    try: p.wait(timeout=10)
    except Exception: p.kill()
print("SMOKE", "PASS" if ok else "FAIL"); sys.exit(0 if ok else 1)
