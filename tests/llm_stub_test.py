"""AI adapter test against a local STUB OpenAI-compatible server (no real model, no network).
Proves: the adapter sends the right request, parses the JSON reply, marks the result ai=True,
flags steps the source text doesn't support, falls back to rule-based when the model returns junk,
and still passes a grounded question through. It does NOT show any real model's quality."""
import json, os, subprocess, sys, threading, time, http.server, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = ("<html><head><title>Fold a paper boat</title></head><body><h1>Fold a paper boat</h1>"
        "<p>Take a rectangular sheet of paper. Fold it in half lengthwise and crease it well. "
        "Fold the top corners down to the center crease. Fold the bottom strips up on both sides. "
        "Be careful with scissors if you trim the paper.</p></body></html>")
MODE = {"m": "good"}; SEEN = []
class S(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        self.send_response(200); self.send_header("Content-Type", "text/html"); self.end_headers(); self.wfile.write(PAGE.encode())
    def do_POST(self):
        req = json.loads(self.rfile.read(int(self.headers["Content-Length"]))); SEEN.append((self.headers.get("Authorization"), req))
        if MODE["m"] == "good":
            if "Question:" in req["messages"][-1]["content"]: txt = "Fold the top corners to the center crease."
            else: txt = json.dumps({"title": "Paper boat", "warnings": ["Be careful with scissors."], "materials": ["paper"],
                "steps": [{"title": "Fold in half", "detail": "Fold the sheet in half lengthwise and crease it."},
                          {"title": "Fold corners", "detail": "Fold the top corners down to the center crease."},
                          {"title": "Fold strips up", "detail": "Fold the bottom strips up on both sides."},
                          {"title": "Glue a motor", "detail": "Attach an electric motor with epoxy."}]})
        else: txt = "sorry I cannot do that"
        b = json.dumps({"choices": [{"message": {"content": txt}}]}).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(b)
stub = http.server.ThreadingHTTPServer(("127.0.0.1", 8799), S); threading.Thread(target=stub.serve_forever, daemon=True).start()
env = dict(os.environ, PORT="8798", STEPWISE_LLM_BASE_URL="http://127.0.0.1:8799/v1", STEPWISE_LLM_KEY="k", STEPWISE_LLM_MODEL="stub-1", STEPWISE_AI_BUILD="1")
srv = subprocess.Popen([sys.executable, os.path.join(ROOT, "server.py")], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.5)
def post(p, o): return json.load(urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:8798" + p, json.dumps(o).encode(), {"Content-Type": "application/json"})))
fails = []
def check(n, c, extra=""):
    print(("PASS " if c else "FAIL ") + n + (" " + str(extra) if extra and not c else "")); 
    if not c: fails.append(n)
try:
    check("status reports ai on", json.load(urllib.request.urlopen("http://127.0.0.1:8798/api/status")) == {"ai": True, "model": "stub-1"})
    r = post("/api/tutorial2", {"url": "http://127.0.0.1:8799/page"})
    check("AI path used, ai=True", r.get("ai") is True, r.get("method"))
    check("invented step removed from steps (3 kept)", len(r["steps"]) == 3, len(r["steps"]))
    check("request had bearer key and model", SEEN[0][0] == "Bearer k" and SEEN[0][1]["model"] == "stub-1")
    check("no kept step mentions the invented motor", "motor" not in json.dumps(r["steps"]).lower())
    check("invented step listed in rejected_steps", len(r.get("rejected_steps", [])) == 1 and "motor" in r["rejected_steps"][0].lower(), r.get("rejected_steps"))
    check("kept steps are all grounded", all(x.get("grounded") for x in r["steps"]))
    r_old = post("/api/tutorial", {"url": "http://127.0.0.1:8799/page"})
    check("old /api/tutorial path also rejects the invented step", len(r_old["steps"]) == 3 and len(r_old.get("rejected_steps", [])) == 1 and "motor" not in json.dumps(r_old["steps"]).lower())
    a = post("/api/ask", {"question": "what do I do with the top corners", "step": "Fold corners", "context": PAGE})
    check("ask uses the model", a.get("ai") is True and "corners" in a["answer"].lower())
    MODE["m"] = "good"
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--no-sandbox"])
            pg = b.new_page(viewport={"width": 700, "height": 900}); pg.goto("http://127.0.0.1:8798/")
            pg.fill("#q", "http://127.0.0.1:8799/page"); pg.click("#go"); pg.wait_for_selector("text=steps matched to source", timeout=20000)
            body = pg.inner_text("body")
            check("UI shows 'Removed: not found in the source' with the invented step", "Removed: not found in the source" in body and "electric motor" in body)
            check("UI step list has 3 steps, motor not among them", pg.locator(".step").count() == 3 and "motor" not in pg.locator(".step").all_inner_texts().__str__().lower(), pg.locator(".step").count())
            pg.screenshot(path="/tmp/ui_rejected.png"); b.close()
    except ImportError:
        print("SKIP UI check (playwright not installed)")
    MODE["m"] = "junk"
    r2 = post("/api/tutorial2", {"url": "http://127.0.0.1:8799/page"})
    check("junk model reply falls back to rule-based", r2.get("ai") is False and len(r2["steps"]) >= 2, r2.get("method"))
    sys.path.insert(0, ROOT); os.environ["STEPWISE_LLM_BASE_URL"] = ""
    import server as _s
    _s.page_text = lambda u: {"title": "Fold a paper boat", "text": "Take a sheet of paper. Fold it in half and crease it well. Fold the top corners down to the center. Fold the bottom strips up on both sides.", "has_captions": False, "source": "youtube"}
    vn = _s.build("https://www.youtube.com/watch?v=x").get("video_note", "")
    check("video without captions says description-only", "title and description only" in vn, vn)
    _s.page_text = lambda u: {"title": "t", "text": "Take a sheet of paper. Fold it in half and crease it well. Fold the top corners down to the center. Fold the bottom strips up.", "has_captions": True, "source": "youtube"}
    check("video with captions says captions used", "captions were found" in _s.build("https://www.youtube.com/watch?v=x").get("video_note", ""))
finally:
    srv.terminate(); stub.shutdown()
print("FAILED:" if fails else "ALL PASS", fails)
sys.exit(1 if fails else 0)
