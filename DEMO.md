# 3 minute demo script (what is real)
1. Open http://localhost:8765. Say: "Stepwise turns any tutorial into a checklist you can do and get unstuck on." (paper is just what we have today)
2. Type a topic: "make a paper airplane". Open "How the agent found this": search, candidates, rejected pages, chosen source. Point at warnings, steps, section badge, "Where this comes from".
3. Tick two steps; open "I'm stuck", ask "what if my paper is too thick". Say it retrieves cited passages from the source; an AI model is optional and not connected in this demo.
4. Open a built-in guide (airplane). Tap AR guide. Show the marker (marker.html on a phone, or printed) to the laptop camera. The 3D fold sits on the marker and animates; Next/Back step through. Say plainly: it tracks the marker, not the paper, and only the first folds are simulated; other steps are text.
5. Show the coffee guide: hot-water warning first. Show a risky query (e.g. a wiring tutorial link) triggering the high-risk banner.
6. Close: tests (python3 -m unittest tests.test_core; node tests/fold.test.js; python3 tests/e2e.py) and the limits list in README.
Do not claim: AI answers, real-phone AR tested, tracking of the paper, fold checking, all-task 3D.
