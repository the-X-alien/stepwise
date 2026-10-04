"""End-to-end API smoke test against a running Step by Step server.

Usage: python3 scripts/smoke.py [base_url]
"""

import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3111"

PASSED = 0
FAILED = 0


def check(label, condition, detail=""):
    global PASSED, FAILED
    if condition:
        PASSED += 1
        print(f"  PASS  {label}")
    else:
        FAILED += 1
        print(f"  FAIL  {label} {detail}")


def post(path, payload):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode(),
        headers={"content-type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=40) as res:
            return res.status, json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"raw": body}


GUIDE_TEXT = """Replacing a laptop battery
1. Power off the laptop and unplug the charger. Wait about 2 minutes.
2. Warning: do not puncture the battery, it can catch fire.
3. Remove the ten screws around the bottom cover with a Phillips screwdriver.
4. Pry the bottom cover off starting at the hinge side. Do not use metal tools.
5. Disconnect the battery connector from the motherboard. It is a press fit.
6. Lift the old battery out and place the new one in the same orientation.
7. Reconnect the battery connector and press until it clicks.
8. Screw the bottom cover back on and charge to 100 percent before first use."""

print("\n== 1. Ingest: pasted guide text ==")
status, data = post("/api/ingest", {"input": GUIDE_TEXT})
check("HTTP 200", status == 200, f"got {status}")
guide = data.get("guide", {})
check("title extracted", guide.get("title") == "Replacing a laptop battery", guide.get("title"))
check("8 steps parsed", len(guide.get("steps", [])) == 8, len(guide.get("steps", [])))
check(
    "battery warning hoisted",
    any("puncture" in w["text"].lower() for w in guide.get("warnings", [])),
    guide.get("warnings"),
)
check(
    "second warning hoisted (metal tools)",
    any("metal" in w["text"].lower() for w in guide.get("warnings", [])),
    guide.get("warnings"),
)
check("screwdriver detected", "screwdriver" in guide.get("tools", []), guide.get("tools"))
check(
    "duration parsed",
    guide["steps"][0].get("estSeconds") == 120,
    guide["steps"][0].get("estSeconds"),
)
check("step indices sequential", [s["index"] for s in guide["steps"]] == list(range(1, 9)))

print("\n== 2. Ingest: bad input is rejected ==")
status, _ = post("/api/ingest", {"input": "too short"})
check("short input rejected (400)", status == 400, status)
status, _ = post("/api/ingest", {"input": "the the the the the the the the the the"})
check("no-step text rejected (422)", status == 422, status)

print("\n== 3. Ingest: demo guide loads ==")
status, data = post("/api/ingest", {"demoId": "demo-bike-brake"})
check("HTTP 200", status == 200, status)
check("6 steps", len(data["guide"]["steps"]) == 6)
check("2 warnings", len(data["guide"]["warnings"]) == 2)
check("every step has a verify hint", all(s["verifyHint"] for s in data["guide"]["steps"]))

print("\n== 4. Verify: cached verdict (offline demo path) ==")
bike = data["guide"]
step4 = bike["steps"][3]
status, data = post(
    "/api/verify",
    {
        "guideId": "demo-bike-brake",
        "stepIndex": 4,
        "image": "data:image/jpeg;base64,AAAA",
        "step": step4,
        "guideTitle": bike["title"],
    },
)
check("HTTP 200", status == 200, status)
verdict = data.get("verdict", {})
check("status not_yet", verdict.get("status") == "not_yet", verdict.get("status"))
check("marked cached", verdict.get("cached") is True)
check("problem stated", bool(verdict.get("problem")))
check("fix given", bool(verdict.get("fix")))
check("evidence non-empty", len(verdict_ev := verdict.get("evidence", [])) > 0, verdict_ev)

print("\n== 5. Verify: uncached step without a photo ==")
status, data = post(
    "/api/verify",
    {"guideId": "demo-bike-brake", "stepIndex": 1, "image": "", "step": bike["steps"][0], "guideTitle": bike["title"]},
)
check("rejects missing photo (400)", status == 400, status)

print("\n== 6. Verify: missing key degrades honestly, never fakes a pass ==")
status, data = post(
    "/api/verify",
    {
        "guideId": "demo-bike-brake",
        "stepIndex": 1,
        "image": "data:image/jpeg;base64,AAAA",
        "step": bike["steps"][0],
        "guideTitle": bike["title"],
    },
)
check("HTTP 200", status == 200, status)
check(
    "never claims pass without a model",
    data.get("verdict", {}).get("status") in ("unclear", "not_yet"),
    data.get("verdict", {}).get("status"),
)
check("evidence explains why", len(data.get("verdict", {}).get("evidence", [])) > 0)

print("\n== 7. Ask: grounded retrieval cites real steps ==")
status, data = post(
    "/api/ask",
    {
        "guide": guide,
        "question": "how do I disconnect the battery connector?",
        "stepIndex": 5,
    },
)
check("HTTP 200", status == 200, status)
answer = data.get("answer", {})
valid = {s["index"] for s in guide["steps"]}
check("citations are real step numbers", set(answer.get("citations", [])) <= valid, answer.get("citations"))
check("cites step 5", 5 in answer.get("citations", []), answer.get("citations"))
check("answer is grounded", answer.get("grounded") is True)
check("answer quotes the guide", "connector" in answer.get("answer", "").lower(), answer.get("answer"))

print("\n== 8. Ask: unrelated question is refused, not hallucinated ==")
status, data = post(
    "/api/ask",
    {"guide": guide, "question": "what is the capital of France?"},
)
check("HTTP 200", status == 200, status)
answer = data.get("answer", {})
check("not grounded", answer.get("grounded") is False, answer)
check("no citations", answer.get("citations") == [], answer.get("citations"))
check("says it could not find it", "couldn't find" in answer.get("answer", "").lower(), answer.get("answer"))

print(f"\n{'=' * 46}\n  {PASSED} passed, {FAILED} failed\n{'=' * 46}\n")
sys.exit(1 if FAILED else 0)