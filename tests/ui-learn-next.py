# Completion-screen flow on a fresh profile, using ONLY the buttons a phone user taps:
# path -> lesson 1 -> complete -> "Next lesson" must open lesson 2 (not replay 1), then chain through every
# lesson via Next (taking the chest screen when offered), checking progress is saved before each jump,
# state is fresh in each lesson, and that Back to path / reload resumes at the right lesson mid-chapter.
import sys, os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from learnlib import check_all, play_lesson
URL=sys.argv[1] if len(sys.argv)>1 else "http://127.0.0.1:8765/"
SHOT=sys.argv[2] if len(sys.argv)>2 else None
fails=[]
def S(pg): return pg.evaluate("()=>LorcanaLearn.state()")
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,device_scale_factor=2)
    pg=ctx.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(URL+"#learn"); pg.wait_for_selector(".ln",timeout=60000)
    ids=pg.evaluate("()=>LorcanaLearn._test.flat().map(x=>x.l.id)")
    try:
        # start from the path like a user: tap the current node
        pg.locator(".ln.cur").tap(); pg.wait_for_selector(".llesson .lprompt",timeout=20000)
        assert S(pg)["cur"]==ids[0], f"path opened {S(pg)['cur']} not {ids[0]}"
        chests=0
        for i,lid in enumerate(ids):
            st=S(pg); assert st["cur"]==lid, f"expected {lid}, got {st['cur']}"
            assert st["si"]==0 and st["hist"]==0 and not st["answered"], f"{lid} stale state {st}"
            play_lesson(pg,None,None,lid,wrong=False)
            assert lid in S(pg)["P"]["done"], f"{lid} not saved on completion"
            saved=pg.evaluate("()=>JSON.parse(localStorage.getItem('lorcanaLearn.v2')).done")
            assert lid in saved, f"{lid} not in localStorage"
            if i==0 or i==3:
                check_all(pg,f"{lid} complete screen")
                if SHOT: pg.screenshot(path=f"{SHOT}/complete_{lid}.png")
            if i==len(ids)-1:
                assert pg.locator("[data-act=lesson]").count()==0, "Next shown after final lesson"
                break
            if pg.locator("[data-act=chestnext]").count():
                pg.locator("[data-act=chestnext]").tap(); pg.wait_for_selector("text=Chapter chest"); chests+=1
                if chests==1:
                    check_all(pg,"chest screen")
                    if SHOT: pg.screenshot(path=f"{SHOT}/chest.png")
            nb=pg.locator(".llesson [data-act=lesson]")
            assert nb.count()==1, f"no Next button after {lid}"
            nb.tap(); pg.wait_for_selector(".llesson .lprompt",timeout=20000)
            if i==0: assert S(pg)["cur"]==ids[1], f"Next after lesson 1 opened {S(pg)['cur']}"
        print("chained lessons:",len(ids),"chests via Next:",chests)
        n=pg.evaluate("()=>LorcanaLearn._test.flat().reduce((a,x)=>a.add(x.ch.id),new Set()).size")
        assert chests==n, f"chest screens {chests} != chapters {n}"
        # resume mid-chapter on a fresh profile: finish 2 lessons, go Back to path, reload, tap current node
        pg.evaluate("()=>localStorage.removeItem('lorcanaLearn.v2')"); pg.goto(URL+"#learn"); pg.reload(); pg.wait_for_selector(".ln",timeout=60000)
        for k in range(2):
            pg.locator(".ln.cur").tap(); pg.wait_for_selector(".llesson .lprompt",timeout=20000); play_lesson(pg,None,None,ids[k],wrong=False)
            pg.locator(".llesson [data-act=back]").tap(); pg.wait_for_selector(".ln.cur")
        # back mid-lesson keeps nothing stale
        pg.locator(".ln.cur").tap(); pg.wait_for_selector(".llesson .lprompt"); pg.locator(".lbar [data-act=back]").tap(); pg.wait_for_selector(".ln.cur")
        pg.reload(); pg.wait_for_selector(".ln",timeout=60000)
        check_all(pg,"path after reload")
        pg.locator(".ln.cur").tap(); pg.wait_for_selector(".llesson .lprompt",timeout=20000)
        assert S(pg)["cur"]==ids[2], f"resume opened {S(pg)['cur']} not {ids[2]}"
        assert S(pg)["si"]==0, "resumed lesson not at step 1"
        if SHOT: pg.screenshot(path=f"{SHOT}/resume.png")
    except Exception as e:
        fails.append(str(e).splitlines()[0][:300])
    if errs: fails.append("JS errors: "+"; ".join(errs[:3]))
    ctx.close(); b.close()
print("ui-learn-next:","FAILED :: "+" | ".join(fails) if fails else "all passed")
sys.exit(1 if fails else 0)
