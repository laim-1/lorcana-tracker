# Pass-and-play: full 2-player game through the UI (hand-off covers, both mulligans, both seats act, no AI moves).
# Usage: python3 tests/ui-pp.py <url> [engine]
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; ENGN = sys.argv[2] if len(sys.argv) > 2 else "chromium"; fails = []
with sync_playwright() as p:
    b = getattr(p, ENGN).launch(); kw = dict(viewport={"width": 390, "height": 844}, has_touch=True, device_scale_factor=2)
    if ENGN == "chromium": kw["is_mobile"] = True
    ctx = b.new_context(**kw); ctx.add_init_script("localStorage.setItem('lorcanaPlaySettings.v1','{\"level\":\"normal\",\"speed\":\"fast\",\"tips\":false}')")
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script("window.__aiCalls=0;setInterval(()=>{const E=window.LorcanaEngine;if(E&&!E.__w){E.__w=1;const o=E.aiChoose;E.__o=o;E.aiChoose=function(){window.__aiCalls++;return o.apply(this,arguments)}}},30)")
    pg.goto(URL + "#play"); pg.wait_for_selector(".dopt", timeout=60000)
    pg.tap("[data-a=mode][data-v=pp]"); pg.wait_for_timeout(200)
    if "Pass and play" not in pg.inner_text(".ptitle"): fails.append("mode title")
    pg.tap("[data-a=start]"); pg.wait_for_selector("[data-a=tomull]:not(.hidden)", timeout=8000); pg.tap("[data-a=tomull]")
    for seat in (0, 1):
        pg.wait_for_selector(f"[data-a=handoff][data-v='{seat}']", timeout=5000)
        if pg.locator(".bcard").count(): fails.append("hand visible behind mulligan hand-off")
        pg.tap(f"[data-a=handoff][data-v='{seat}']"); pg.wait_for_selector("[data-a=mdone]"); pg.tap("[data-a=mdone]"); pg.wait_for_timeout(1500)
    handoffs = 0; turns = set(); seats_seen = set()
    for i in range(4000):
        st = pg.evaluate("()=>{const S=LorcanaPlay.state(),st=S.st;return st?{w:st.winner,a:st.active,pend:st.pending?st.pending.pi:null,ho:!!document.querySelector('[data-a=handoff]'),hand:document.querySelectorAll('.hand2 .hc').length,t:st.turnNo}:null}")
        if not st or st["w"] is not None: break
        if st["ho"]:
            if st["hand"]: fails.append("hand visible behind hand-off")
            v = pg.get_attribute("[data-a=handoff]", "data-v"); seats_seen.add(v); pg.tap("[data-a=handoff]"); handoffs += 1; pg.wait_for_timeout(150); continue
        turns.add(st["t"])
        r = pg.evaluate("()=>{const S=LorcanaPlay.state(),st=S.st,E=window.LorcanaEngine;const a=E.__o(st,'normal');if(!a)return'none';if(a.t==='end'&&!st.pending)return'end';E.act(st,a);LorcanaPlay.render();return a.t}")
        if r == "end": pg.tap("[data-a=end]")
        pg.wait_for_timeout(30)
    res = pg.evaluate("()=>({w:LorcanaPlay.state().st.winner,ai:window.__aiCalls,end:!!document.querySelector('.modal.end'),title:(document.querySelector('.modal.end h2')||{}).innerText})")
    print("winner", res, "handoffs", handoffs, "turns", max(turns) if turns else 0, "seats", seats_seen)
    if res["w"] is None: fails.append("game did not finish")
    if res["ai"]: fails.append(f"AI was consulted {res['ai']} times by the UI")
    if handoffs < 4 or seats_seen != {"0", "1"}: fails.append("hand-offs missing")
    if not res["end"] or "wins" not in (res["title"] or ""): fails.append("end screen")
    if errs: fails.append("JS: " + "; ".join(errs[:3]))
    b.close()
print("ui-pp:", "FAILED " + "; ".join(fails) if fails else "passed"); sys.exit(1 if fails else 0)
