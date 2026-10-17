# Learn: path renders (15 chapters, 135 lessons), unlock/progress/persistence, a lesson completes, chest claims.
# Usage: python3 tests/ui-learn.py <url>
import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else "http://127.0.0.1:8765/"
fails=[]
def check(cond,msg):
    print(("ok  " if cond else "FAIL ")+msg)
    if not cond: fails.append(msg)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,device_scale_factor=2)
    pg=ctx.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(URL+"#learn"); pg.wait_for_selector(".ln",timeout=60000); pg.wait_for_timeout(800)
    counts=pg.evaluate("""()=>({chapters:document.querySelectorAll('.lchap').length,lessons:document.querySelectorAll('.ln[data-id^=\"c\"]').length,chests:document.querySelectorAll('.ln.chest').length,body:document.body.innerText.slice(0,120)})""")
    # lessons selector includes chest ids ch*; count lesson buttons via titles in data: use all .ln minus chests
    lessons=pg.evaluate("""()=>document.querySelectorAll('.ln:not(.chest)').length""")
    check(counts["chapters"]==15,f"15 chapters ({counts})")
    check(lessons==135,f"135 lesson/trophy nodes ({lessons})")
    check(counts["chests"]==15,f"15 chest nodes ({counts['chests']})")
    check(pg.locator(".ln.lock").count()>100,"later lessons locked")
    pg.screenshot(path="screenshots/learn-path.png")
    # Complete first lesson start-to-finish: click any visible option/board/do-it, then Continue.
    pg.locator(".ln.cur").first.click(); pg.wait_for_selector(".llesson",timeout=10000)
    pg.screenshot(path="screenshots/learn-lesson.png")
    tried=0
    for step in range(40):
        if pg.locator("text=Lesson complete").count(): break
        feed=pg.locator(".lfeed:not([hidden]) .lgo")
        if feed.count(): feed.first.click(); tried=0; pg.wait_for_timeout(200); continue
        opts=pg.locator(".lopt:not([disabled]), .lbcard:not([disabled])")
        if opts.count():
            opts.nth(tried % opts.count()).click(); tried+=1; pg.wait_for_timeout(200); continue
        go=pg.locator(".llesson .lgo")
        if go.count(): go.first.click(); tried=0; pg.wait_for_timeout(250); continue
        pg.wait_for_timeout(250)
    check(pg.locator("text=Lesson complete").count()>0,"first lesson completed start-to-finish")
    xp=pg.evaluate("""()=>JSON.parse(localStorage.getItem('lorcanaLearn.v1')||'{}').xp""")
    check(bool(xp),"XP saved "+str(xp))
    pg.reload(); pg.wait_for_selector(".ln",timeout=60000); pg.wait_for_timeout(500)
    done=pg.evaluate("""()=>Object.keys(JSON.parse(localStorage.getItem('lorcanaLearn.v1')||'{}').done||{}).length""")
    check(done>=1,f"progress persists after reload (done={done})")
    # Seed 4 done to screenshot/claim chest (test-only setup), then real click claim
    pg.evaluate("""()=>{const o=JSON.parse(localStorage.getItem('lorcanaLearn.v1')||'{}');o.done={c1l1:1,c1l2:1,c1l3:1,c1l4:1};localStorage.setItem('lorcanaLearn.v1',JSON.stringify(o))}""")
    pg.reload(); pg.wait_for_selector(".ln.chest",timeout=60000); pg.wait_for_timeout(500)
    pg.locator(".ln.chest").first.scroll_into_view_if_needed(); pg.wait_for_timeout(300); pg.screenshot(path="screenshots/learn-chest.png")
    before=pg.evaluate("""()=>JSON.parse(localStorage.getItem('lorcanaLearn.v1')||'{}').xp||0""")
    pg.locator(".ln.chest").first.click(); pg.wait_for_timeout(400)
    after=pg.evaluate("""()=>JSON.parse(localStorage.getItem('lorcanaLearn.v1')||'{}')""")
    check(after.get("xp",0)>=before+20 and after.get("chests"),f"chest claims +20 XP and sparkle (before={before} after={after})")
    check(not errs,f"no JS errors {errs[:3]}")
    ctx.close(); b.close()
print("ui-learn:","FAILED "+", ".join(fails) if fails else "all passed"); sys.exit(1 if fails else 0)
