#!/usr/bin/env python3
"""Static smoke: overnight polish hooks present in play.js / app.js."""
from pathlib import Path
import sys
root = Path(__file__).resolve().parents[1]
play = (root / "js/play.js").read_text()
app = (root / "js/app.js").read_text()
checks = [
    ("againSwap", "againSwap" in play),
    ("sumcopy", "sumcopy" in play),
    ("quick play", 'data-a="quick"' in play),
    ("histf", 'data-a="histf"' in play),
    ("histexp", 'data-a="histexp"' in play),
    ("bdel", 'data-a="bdel"' in play),
    ("brename", 'data-a="brename"' in play),
    ("bhandagain", 'data-a="bhandagain"' in play),
    ("Escape close", "Escape" in play),
    ("nearSheet", "nearSheet" in app),
    ("wclear", 'id="wclear"' in app),
    ("finishCost", "finishCost" in app),
    ("remain sort", "Closest to done" in app),
]
bad = [n for n, ok in checks if not ok]
for n, ok in checks:
    print(("ok  " if ok else "FAIL"), n)
if bad:
    sys.exit(1)
print("ui-static-overnight: passed", len(checks))
