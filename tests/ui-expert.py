# Expert AI on a throttled phone (Chromium, 390x844, 4x CPU slowdown): the search runs in a Web Worker, each decision
# answers within 1.5s, and the main thread never stalls (max rAF gap) while the AI thinks. Also checks the Expert pill.
# Usage: python3 tests/ui-expert.py <url> [turns]
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; TURNS = int(sys.argv[2]) if len(sys.argv) > 2 else 6
INIT = """localStorage.setItem('lorcanaPlaySettings.v1','{"level":"expert","speed":"fast","sound":false,"tips":false}');
window.__w={posts:0,replies:0,lat:[]};const OW=window.Worker;window.Worker=function(u){const w=new OW(u);const P=w.postMessage.bind(w);let t=0;
 w.postMessage=m=>{window.__w.posts++;t=performance.now();P(m)};w.addEventListener('message',e=>{if(e.data.err)(window.__w.errs=window.__w.errs||[]).push(e.data.err);window.__w.replies++;window.__w.lat.push(performance.now()-t)});return w};
window.__sync=[];setInterval(()=>{const E=window.LorcanaEngine;if(E&&!E.__x){E.__x=1;const o=E.aiChoose;E.aiChoose=function(st,l){const a=o(st,l);if(l&&l.startsWith('expert'))window.__sync.push(a&&a.t);return a}}},30);window.__gap=0;let __l=performance.now();const f=()=>{const n=performance.now();if(window.__mon)window.__gap=Math.max(window.__gap,n-__l);__l=n;requestAnimationFrame(f)};requestAnimationFrame(f);"""
fails = []
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    ctx.add_init_script(INIT); pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL + "#play"); pg.wait_for_selector(".dopt", timeout=60000)
    if not pg.locator("[data-a=lvl][data-v=expert]").count(): fails.append("no Expert pill in the menu")
    cdp = ctx.new_cdp_session(pg); cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
    pg.evaluate("()=>{const s=LorcanaPlay.state();s.screen='menu';s.st=null;s.deck='s3';s.opp='s9';LorcanaPlay.render()}")
    pg.tap("[data-a=start]"); pg.wait_for_selector("[data-a=tomull]:not(.hidden)", timeout=8000); pg.tap("[data-a=tomull]")
    pg.wait_for_selector("[data-a=mdone]", timeout=8000); pg.tap("[data-a=mdone]"); pg.wait_for_function("LorcanaPlay.state().screen==='board'", timeout=15000)
    lbl = pg.inner_text("#lore-1")
    if "EXPERT" not in lbl: fails.append("HUD label missing EXPERT: " + lbl)
    turns = 0
    for i in range(4000):
        r = pg.evaluate("""()=>{const S=LorcanaPlay.state(),st=S.st,E=window.LorcanaEngine;if(!st)return'none';if(st.winner!=null)return'over';
          if(st.active!==0||S.busy){window.__mon=true;return'wait'}window.__mon=false;st.human=[true,false];const a=E.aiChoose(st,'normal');if(!a)return'wait';if(a.t==='end')return'end';E.act(st,a);LorcanaPlay.render();return'acted'}""")
        if r == "over": break
        if r == "end":
            turns += 1
            if turns > TURNS: break
            pg.wait_for_selector("[data-a=end]", timeout=5000); pg.eval_on_selector("[data-a=end]", "e=>e.click()")
            pg.wait_for_timeout(150)
            if pg.locator("[data-a=endforce]").count(): pg.eval_on_selector("[data-a=endforce]", "e=>e.click()")
        pg.wait_for_timeout(40 if r == "acted" else 100)
    w = pg.evaluate("window.__w"); gap = pg.evaluate("window.__gap"); lat = w["lat"]
    print(w.get("errs"), pg.evaluate("window.__sync"));print(json.dumps({"turns": turns, "workerDecisions": w["replies"], "maxLatencyMs": round(max(lat or [0])), "avgLatencyMs": round(sum(lat) / max(1, len(lat))), "maxFrameGapMs": round(gap)}))
    if w["replies"] < 3: fails.append("Expert did not use the worker")
    if lat and max(lat) > 1500: fails.append("decision over 1.5s: %d" % max(lat))
    if gap > 400: fails.append("main thread stalled %dms" % gap)
    if errs: fails.append("JS errors: " + "; ".join(errs[:3]))
    b.close()
print("ui-expert:", "FAILED " + "; ".join(fails) if fails else "passed"); sys.exit(1 if fails else 0)
