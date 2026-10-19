# Learn smoke + progress migration test. Usage: python3 tests/ui-learn.py <url>
import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else "http://127.0.0.1:8765/"
fails=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":390,"height":844})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(URL); pg.evaluate("()=>{localStorage.removeItem('lorcanaLearn.v2');localStorage.setItem('lorcanaLearn.v1',JSON.stringify({done:{c1l1:1,c2l1:1,c3l4:1},xp:70,streak:3,lastDay:'2026-10-18',chests:{ch1:1}}))}")
    pg.goto(URL+"#learn"); pg.reload(); pg.wait_for_selector(".ln",timeout=60000)
    st=pg.evaluate("()=>{const s=LorcanaLearn.state().P;const f=LorcanaLearn._test.flat();return{xp:s.xp,streak:s.streak,ch1:f.filter(x=>x.ci===0).every(x=>s.done[x.l.id]),ch2:f.filter(x=>x.ci===1).every(x=>s.done[x.l.id]),ch3:f.filter(x=>x.ci===2).some(x=>s.done[x.l.id])}}")
    print("migrated:",st)
    if not(st["xp"]==70 and st["streak"]==3 and st["ch1"] and st["ch2"] and not st["ch3"]): fails.append("migration "+str(st))
    cur=pg.locator(".ln.cur").get_attribute("data-id")
    if cur!="s1": fails.append("current lesson after migration "+str(cur))
    if pg.locator(".ln.lock").count()<1: fails.append("locked later lessons missing")
    pg.locator(".ln.cur").click(); pg.wait_for_selector(".lboard",timeout=20000)
    if errs: fails.append("JS errors "+str(errs[:2]))
    b.close()
print("ui-learn:", "FAILED "+" | ".join(fails) if fails else "all passed"); sys.exit(1 if fails else 0)
