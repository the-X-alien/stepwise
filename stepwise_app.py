"""Desktop launcher: starts the local Stepwise server on 127.0.0.1 and opens the browser. Used as the PyInstaller entry point.
Env: PORT (default: first free port from 8765), STEPWISE_NO_BROWSER=1 (CI/smoke tests),
STEPWISE_IDLE_SECONDS (quit after this many seconds with no requests; the macOS .app sets 1800 since it has no window to close)."""
import os, socket, sys, threading, time, webbrowser, http.server
if sys.stdout is None: sys.stdout = open(os.devnull, "w")   # windowed builds have no console
if sys.stderr is None: sys.stderr = open(os.devnull, "w")
import server

LAST = [time.time()]
class Tracked(server.H):
    def handle(self):
        LAST[0] = time.time(); super().handle()

def free_port(start=8765):
    for p in range(start, start + 50):
        with socket.socket() as s:
            try: s.bind(("127.0.0.1", p)); return p
            except OSError: continue
    raise SystemExit("No free port found in 8765-8814")

def main():
    port = int(os.environ["PORT"]) if os.environ.get("PORT") else free_port()
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), Tracked)
    url = "http://localhost:%d/" % port
    print("Stepwise running at", url, "(Ctrl+C to stop). AI: " + ("on (" + server.LLM_MODEL + ")" if server.LLM_URL else "off"), flush=True)
    idle = int(os.environ.get("STEPWISE_IDLE_SECONDS", "1800" if (getattr(sys, "frozen", False) and sys.platform == "darwin") else "0") or 0)
    if idle:
        def watch():
            while True:
                time.sleep(min(5, idle))
                if time.time() - LAST[0] > idle: httpd.shutdown(); return
        threading.Thread(target=watch, daemon=True).start()
    if not os.environ.get("STEPWISE_NO_BROWSER"):
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try: httpd.serve_forever()
    except KeyboardInterrupt: pass
    finally: httpd.server_close()

if __name__ == "__main__": main()
