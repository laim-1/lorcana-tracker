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
    ("foilsTotal", "foilsTotal" in app),
    ("illegalWhy", "illegalWhy" in play),
    ("handoff score", "hscore" in play),
    ("rematchdecks", "rematchdecks" in play),
    ("expanded tips", "Sing Together" in play and play.count("const TIPS=")==1),
    ("drying banner", "drying" in play),
    ("playerConfirm", "playerConfirm" in play),
    ("end drying note", "still drying" in play),
    ("ready chip", "rdyb" in play),
    ("empty strip", "emptystrip" in play),
    ("handoff board", "hboard" in play),
    ("hist best/daily", "dailyW" in play and "Best " in play),
    ("banner ready count", "readyN" in play),
    ("daily WL on button", "HS.dailyW" in play),
    ("hand empty", "handempty" in play),
    ("pause ready/dry", "rdy0" in play and "drying" in play),
    ("READY tip", "Green READY" in play),
    ("histbar best", "Best " in play and "histbar" in play),
    ("endboard", "endboard" in play),
    ("handoff decks", "hdecks" in play),
    ("Bodyguard tip", "Bodyguard" in play and "Ward" in play),
    ("hint highlight toast", "Highlighted:" in play),
    ("emptychip", "emptychip" in play),
    ("hints on banner", "hints on" in play),
    ("handoff hand", "in hand" in play and "inkable" in play),
    ("pausemeta", "pausemeta" in play),
    ("questable lore", "questable" in play),
    ("Support tip", "Support:" in play),
    ("sumcopy chars", "chars ·" in play),
    ("Evasive tip", "Evasive characters can only be challenged" in play),
]
bad = [n for n, ok in checks if not ok]
for n, ok in checks:
    print(("ok  " if ok else "FAIL"), n)
if bad:
    sys.exit(1)
print("ui-static-overnight: passed", len(checks))
