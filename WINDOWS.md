# Run on Windows (PowerShell). Installability checked, NOT run on Windows.
Needs Python 3.10 or newer (check: `py --version`; install from python.org or the Microsoft Store) and Chrome or Edge. 64-bit Windows (a T14 Gen 1 AMD is x64).

## Full app (search, links, questions)
    cd path\to\stepwise
    py -m venv .venv
    .\.venv\Scripts\python.exe -m pip install -r requirements.txt
    .\.venv\Scripts\python.exe server.py
Open http://localhost:8765 in Chrome or Edge. You don't need to activate the venv, so PowerShell script-policy errors don't apply. If `py` isn't found, use `python`.
Smaller install if trafilatura gives trouble: use `-r requirements-min.txt` (pages without HowTo markup then use plain-text extraction).

## Plan B: no pip at all (built-in guides + AR only, no search/links)
    cd path\to\stepwise
    py -m http.server 8765 --directory static --bind 127.0.0.1
Open http://localhost:8765. The page says "Offline mode".

## What was checked
- pip dry-run (`pip download --platform win_amd64 --only-binary=:all:`) resolves all 22 packages to Windows x64 wheels for Python 3.10, 3.11, 3.12 and 3.13. That proves packages exist, not that the app runs on Windows. (requests 2.34.2 and trafilatura 2.2.0 require Python >= 3.10.)
- Everything else was tested on Linux in headless Chrome.

## Camera / AR limits
- Laptop webcam works: http://localhost counts as secure; allow the camera when asked.
- A phone camera can't use the app over Wi-Fi without HTTPS, so use the laptop webcam. To show a marker without a printer: open https://jeromeetienne.github.io/AR.js/data/images/HIRO.jpg in the phone's browser (turn brightness up) and aim the laptop webcam at the phone, or draw the paper marker (instructions on marker.html).
- Server binds 127.0.0.1 only. Search and the AR libraries (unpkg.com) need internet.
- No AI model connected by default: answers are cited excerpts or "the source doesn't address that".
