# UI games vs the Normal AI: the AI seat runs through the real Play-mode loop (aiLoop -> E.aiChoose).
# Our seat is driven by the engine's Normal heuristic and ends turns by tapping the real End turn button.
# Usage: python3 tests/ui-ai.py <url> [games]   -> prints the AI's move counts; fails if it never challenges or never plays a non-character.
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; N = int(sys.argv[2]) if len(sys.argv) > 2 else 3
INIT = """localStorage.setItem('lorcanaPlaySettings.v1','{"level":"normal","speed":"fast","sound":false,"tips":false}');
window.__ai={challenge:0,quest:0,play:{},act:0,move:0,ink:0,end:0};
const hook=()=>{const E=window.LorcanaEngine;if(!E||E.__h)return;E.__h=1;const o=E.aiChoose;E.__orig=o;E.aiChoose=function(st,l){const a=o(st,l);
 if(a&&st.active===1&&!st.pending){const s=window.__ai;if(a.t==="play"){const c=E.find(st,a.uid).inst.card;s.play[c.type]=(s.play[c.type]||0)+1}else if(s[a.t]!=null)s[a.t]++}return a}};
setInterval(hook,50);"""
fails = []
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    ctx.add_init_script(INIT); pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL + "#play"); pg.wait_for_selector(".dopt", timeout=60000)
    results = []
    for g in range(N):
        pg.evaluate("S=>{const s=LorcanaPlay.state();s.screen='menu';s.st=null;s.deck='s'+S;s.opp='s'+((S+5)%23);LorcanaPlay.render()}", (g * 7) % 23)
        pg.wait_for_selector("[data-a=start]"); pg.tap("[data-a=start]")
        pg.wait_for_selector("[data-a=tomull]:not(.hidden)", timeout=8000); pg.tap("[data-a=tomull]")
        pg.wait_for_selector("[data-a=mdone]", timeout=8000); pg.tap("[data-a=mdone]")
        pg.wait_for_function("LorcanaPlay.state().screen==='board'", timeout=15000)
        for i in range(3000):
            r = pg.evaluate("""()=>{const S=LorcanaPlay.state(),st=S.st,E=window.LorcanaEngine;if(!st)return'none';if(st.winner!=null)return'over';
              st.human=[false,false];if(st.active!==0||S.busy)return'wait';
              const a=E.__orig(st,'normal');if(!a)return'wait';if(a.t==='end')return'end';E.act(st,a);LorcanaPlay.render();return'acted'}""")
            if r == "over": break
            if r == "end":
                pg.wait_for_selector("[data-a=end]", timeout=5000); pg.tap("[data-a=end]")
            pg.wait_for_timeout(40 if r == "acted" else 120)
        w = pg.evaluate("LorcanaPlay.state().st.winner"); results.append(w); print("game", g, "winner", "AI" if w == 1 else "us" if w == 0 else w, flush=True)
    s = pg.evaluate("window.__ai"); print("AI (Normal) moves over", N, "UI games:", json.dumps(s))
    nonchar = sum(v for k, v in s["play"].items() if k != "character") + s["act"]
    if s["challenge"] == 0: fails.append("AI never challenged")
    if nonchar == 0: fails.append("AI never played an action/song/item/location or used an ability")
    if errs: fails.append("JS errors: " + "; ".join(errs[:3]))
    b.close()
print("ui-ai:", "FAILED " + "; ".join(fails) if fails else "passed"); sys.exit(1 if fails else 0)
