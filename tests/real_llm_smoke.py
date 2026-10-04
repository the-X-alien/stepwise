"""Integration smoke test against a REAL local OpenAI-compatible server (e.g. llama-server on localhost:8089).
Usage: STEPWISE_LLM_BASE_URL=http://localhost:8089/v1 STEPWISE_LLM_MODEL=<name> python tests/real_llm_smoke.py
Checks only that the wiring works end to end (request goes out, reply is parsed or falls back safely). It says nothing about answer quality.
Uses a tiny local page so a 4096-token context is enough. Nothing is exposed beyond 127.0.0.1."""
import json, os, subprocess, sys, threading, time, http.server, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("STEPWISE_LLM_BASE_URL", "http://localhost:8089/v1"); MODEL = os.environ.get("STEPWISE_LLM_MODEL", "local")
PAGE = ("<html><head><title>Fold a paper boat</title></head><body><h1>Fold a paper boat</h1><p>Take a rectangular sheet of paper. "
        "Fold it in half lengthwise and crease it well. Fold the top corners down to the center crease. "
        "Fold the bottom strips up on both sides. Be careful with scissors if you trim the paper.</p></body></html>")
class S(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self): self.send_response(200); self.send_header("Content-Type", "text/html"); self.end_headers(); self.wfile.write(PAGE.encode())
threading.Thread(target=http.server.ThreadingHTTPServer(("127.0.0.1", 8799), S).serve_forever, daemon=True).start()
env = dict(os.environ, PORT="8798", STEPWISE_LLM_BASE_URL=BASE, STEPWISE_LLM_KEY=os.environ.get("STEPWISE_LLM_KEY", "none"), STEPWISE_LLM_MODEL=MODEL, STEPWISE_AI_BUILD="1")
srv = subprocess.Popen([sys.executable, os.path.join(ROOT, "server.py")], env=env, stderr=subprocess.PIPE, text=True); time.sleep(1.5)
def post(p, o, t=240): return json.load(urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:8798" + p, json.dumps(o).encode(), {"Content-Type": "application/json"}), timeout=t))
try:
    t0 = time.time(); r = post("/api/tutorial2", {"url": "http://127.0.0.1:8799/page"})
    print("build: %.0fs ai=%s method=%s" % (time.time() - t0, r.get("ai"), r.get("method")))
    print("steps kept:", [s["title"] for s in r["steps"]]); print("rejected (not in source):", r.get("rejected_steps"))
    t0 = time.time(); a = post("/api/ask", {"question": "what do I do with the top corners", "step": "Fold corners", "context": PAGE})
    print("ask: %.0fs ai=%s answer=%r" % (time.time() - t0, a.get("ai"), a["answer"][:200]))
    print("RESULT:", "model path used" if r.get("ai") else "fell back to rule-based (model reply unusable or unreachable)")
finally:
    srv.terminate(); err = srv.stderr.read()[-500:]; print("server stderr tail:", err.strip() or "(none)")
