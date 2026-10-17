# Learn visuals: no-emoji scan (code + DOM), card images on every lesson screen,
# real game-board spots, image-choice questions, short path labels. Screenshots at 390x844.
# Usage: python3 tests/ui-learn-visuals.py <url>
import re, sys, pathlib
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else "http://127.0.0.1:8765/"
ROOT=pathlib.Path(__file__).resolve().parent.parent
EMOJI=re.compile('[\U0001F000-\U0001FAFF\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u2300-\u23FF]')
fails=[]
def check(cond,msg):
    print(("ok  " if cond else "FAIL ")+msg)
    if not cond: fails.append(msg)
# 1) Code scan: fail if any emoji-range character ships in Learn code/data/styles.
for rel in ["js/learn.js","js/learn-data.js","css/learn.css","index.html.tmpl"]:
    hits=sorted(set(EMOJI.findall((ROOT/rel).read_text())))
    check(not hits, f"no emoji characters in {rel} {hits}")
def wait_imgs(pg):
    pg.wait_for_function("""()=>{const i=[...document.querySelectorAll('#learn img')];return i.length&&i.every(x=>x.complete&&x.naturalWidth>0)}""",timeout=45000)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,device_scale_factor=2)
    pg=ctx.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(URL+"#learn"); pg.wait_for_selector(".ln",timeout=60000); pg.wait_for_timeout(600)
    dom=pg.evaluate("""()=>{const r=document.querySelector('#learn');return{emoji:/[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{FE0F}\\u{2300}-\\u{23FF}]/u.test(r.innerText||''),
      imgs:r.querySelectorAll('img').length,labels:[...r.querySelectorAll('.ln-t')].map(x=>x.innerText.trim()),
      svgs:r.querySelectorAll('.ln svg').length,nodes:r.querySelectorAll('.ln').length}}""")
    check(not dom["emoji"],"no emoji in Learn path DOM")
    check(dom["imgs"]==0,f"path loads no card images (perf guard, got {dom['imgs']})")
    check(dom["svgs"]>=dom["nodes"]>0,f"every path node has a real SVG icon ({dom['svgs']}/{dom['nodes']})")
    check(all(0<len(x)<=14 for x in dom["labels"]),f"path node labels are short {dom['labels'][:6]}")
    pg.locator(".ln.cur").first.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    pg.screenshot(path="screenshots/learn-path.png")
    # 2) Guided lesson board: real zones / inkwell+lore HUD / hand row / empty spots / gold-ring guide.
    pg.evaluate("()=>LorcanaLearn._test.startLesson('c5l1')"); pg.wait_for_selector(".lgb",timeout=10000); wait_imgs(pg); pg.wait_for_timeout(400)
    board=pg.evaluate("""()=>{const r=document.querySelector('#learn');return{imgs:r.querySelectorAll('img').length,
      zones:r.querySelectorAll('.lgb .zone').length,hand:!!r.querySelector('.hand2'),chips:r.querySelectorAll('.lgb .chip').length,
      spots:r.querySelectorAll('.lspot,.zempty').length,guide:r.querySelectorAll('.lbcard.guide').length,
      lore:r.querySelectorAll('.loretrk').length,small:[...r.querySelectorAll('img')].every(i=>(i.getAttribute('src')||'').includes('/small/'))}}""")
    check(board["imgs"]>=2 and board["small"],f"guided board shows small Lorcast card images {board}")
    check(board["zones"]==2 and board["hand"] and board["chips"]>=6 and board["lore"]==2,f"guided board reuses real game spots (zones/hand/inkwell/lore) {board}")
    check(board["spots"]>=1,f"board has real empty/active spots {board}")
    check(board["guide"]==1,f"guided board highlights exactly one card with the game glow ring {board}")
    pg.screenshot(path="screenshots/learn-guided-board.png"); pg.screenshot(path="screenshots/learn-lesson.png")
    # 3) Drive the same lesson to its quick check: choices must be tappable card images.
    for _ in range(8):
        if pg.locator(".lchoice").count(): break
        info=pg.evaluate("""()=>{const st=LorcanaLearn.state();const s=LorcanaLearn._test.getSteps()[st.si];if(!s)return null;const pr=LorcanaLearn._test.getPractice();return{k:s.k,answerId:s.answerId||null,role:pr?pr.practiceRole:null}}""")
        if info["k"]=="board":
            pg.evaluate("""(aid)=>{document.querySelector('.lbcard[data-v="'+aid+'"]').click()}""",info["answerId"]); pg.locator(".lfeed .lgo").click()
        elif info["k"]=="practice":
            pg.evaluate("""(role)=>{document.querySelector('[data-act=pcard][data-v="'+role+'"]').click()}""",info["role"]); pg.locator(".lfeed .lgo").click()
        pg.wait_for_timeout(250)
    check(pg.locator(".lchoice").count()==3,"quick check has 3 image choices")
    wait_imgs(pg); pg.wait_for_timeout(300)
    mc=pg.evaluate("""()=>[...document.querySelectorAll('.lchoice img')].map(i=>({nw:i.naturalWidth,small:(i.getAttribute('src')||'').includes('/small/')}))""")
    check(len(mc)==3 and all(x["nw"]>0 and x["small"] for x in mc),f"image choices are loaded small card images {mc}")
    pg.screenshot(path="screenshots/learn-image-choice.png")
    # 4) Chest screen with real chest icon.
    pg.evaluate("""()=>{localStorage.setItem('lorcanaLearn.v1',JSON.stringify({done:{c1l1:1,c1l2:1,c1l3:1,c1l4:1},xp:40,chests:{},streak:1,lastDay:'2026-10-16',sparkle:false}))}""")
    pg.reload(); pg.wait_for_selector(".ln.chest",timeout=60000); pg.wait_for_timeout(500)
    pg.locator(".ln.chest").first.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    chest=pg.evaluate("""()=>{const c=document.querySelector('.ln.chest');return{svg:!!c.querySelector('svg'),emoji:/[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u.test(c.innerText||'')}}""")
    check(chest["svg"] and not chest["emoji"],f"chest node uses a real SVG icon, no emoji {chest}")
    pg.screenshot(path="screenshots/learn-chest.png")
    check(not errs,f"no JS errors {errs[:3]}")
    ctx.close(); b.close()
print("ui-learn-visuals:","FAILED "+", ".join(fails) if fails else "all passed"); sys.exit(1 if fails else 0)
