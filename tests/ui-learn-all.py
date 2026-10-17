# Exhaustive Learn test: completes EVERY lesson via correct board/practice/MC taps,
# first tries a wrong tap on guided board + practice and asserts it is rejected with explanation.
# Also measures in-page click-handler time under 4x CPU throttle.
# Usage: python3 tests/ui-learn-all.py <url>
import sys, collections
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else "http://127.0.0.1:8765/"
fails=[]; per_ch=collections.Counter(); per_ch_total=collections.Counter()
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,device_scale_factor=2)
    pg=ctx.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    cdp=ctx.new_cdp_session(pg); cdp.send("Emulation.setCPUThrottlingRate",{"rate":4})
    pg.goto(URL+"#learn"); pg.wait_for_selector(".ln",timeout=60000); pg.wait_for_timeout(600)
    perf=pg.evaluate("""()=>{LorcanaLearn._test.startLesson('c1l1');const out=[];for(let i=0;i<3;i++){const s=LorcanaLearn._test.getSteps()[LorcanaLearn.state().si];if(!s||s.k!=='board')break;const btn=document.querySelector('.lbcard[data-v="'+s.answerId+'"]');const t0=performance.now();btn.click();out.push(Math.round((performance.now()-t0)*10)/10);const c=document.querySelector('.lfeed .lgo');if(c)c.click()}return out}""")
    print("perf 4xCPU in-page board-tap handler ms:",perf)
    if not perf or max(perf)>=100: fails.append(f"perf >=100ms {perf}")
    imgs=pg.evaluate("""()=>[...document.querySelectorAll('#learn img')].map(i=>i.getAttribute('src')||'').slice(0,20)""")
    if imgs and not all('/small/' in u for u in imgs): fails.append(f"non-small learn images {imgs[:2]}")
    ids=pg.evaluate("""()=>LorcanaLearn._test.flat().map(x=>x.l.id)""")
    chapters=pg.evaluate("""()=>LorcanaLearn._test.flat().map(x=>x.ci)""")
    for idx,lid in enumerate(ids):
        ch=chapters[idx]+1; per_ch_total[ch]+=1
        try:
            pg.evaluate("(id)=>LorcanaLearn._test.startLesson(id)",lid); pg.wait_for_selector(".llesson",timeout=8000)
            shape=pg.evaluate("""()=>{const s=LorcanaLearn._test.getSteps();return{n:s.length,mc:s.filter(x=>x.k==='mc').length,board:s.filter(x=>x.k==='board').length,practice:s.filter(x=>x.k==='practice').length}}""")
            assert shape=={'n':5,'mc':1,'board':3,'practice':1}, f"step shape {shape}"
            wrong_board_done=False; wrong_practice_done=False
            for step in range(8):
                if pg.locator("text=Lesson complete").count(): break
                # Visual guards: >=1 small lazy card image per screen, real board spots, no emoji in DOM.
                vis=pg.evaluate("()=>{const r=document.querySelector('#learn');const imgs=[...r.querySelectorAll('img')];const emoji=/[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{FE0F}\\u{2300}-\\u{23FF}]/u.test(r.innerText||'');return{n:imgs.length,small:imgs.every(i=>(i.getAttribute('src')||'').includes('/small/')),lazy:imgs.every(i=>i.loading==='lazy'),emoji,board:!!r.querySelector('.lgb .zone'),hand:!!r.querySelector('.hand2'),chips:r.querySelectorAll('.lgb .chip').length,spots:r.querySelectorAll('.lspot,.zempty').length}}")
                assert vis["n"]>=1, f"no card image on lesson screen {vis}"
                assert vis["n"]<=8, f"too many card images on one screen {vis}"
                assert vis["small"] and vis["lazy"], f"non-small/non-lazy learn image {vis}"
                assert not vis["emoji"], "emoji glyph in Learn DOM"
                info=pg.evaluate("""()=>{const st=LorcanaLearn.state();const s=LorcanaLearn._test.getSteps()[st.si];if(!s)return null;const pr=LorcanaLearn._test.getPractice();return{k:s.k,answerId:s.answerId||null,answer:s.answer||null,role:pr?pr.practiceRole:null}}""")
                assert info, "no step info"
                if info["k"] in ("board","practice"):
                    assert vis["board"] and vis["hand"] and vis["chips"]>=6 and vis["spots"]>=1, f"not a real game board {vis}"
                if info["k"]=="board":
                    if not wrong_board_done:
                        wrong=pg.evaluate("""(aid)=>{const b=[...document.querySelectorAll('.lbcard')].find(x=>x.dataset.v!==aid);if(!b)return false;b.click();return true}""",info["answerId"])
                        if wrong:
                            txt=pg.locator(".lfeed").inner_text()
                            assert "try again" in txt.lower(), "wrong board tap not rejected with retry: "+txt[:100]
                            assert pg.locator(".lfeed .lgo").count()==0, "wrong board tap offered Continue"
                            wrong_board_done=True
                    pg.evaluate("""(aid)=>{document.querySelector('.lbcard[data-v="'+aid+'"]').click()}""",info["answerId"])
                    pg.locator(".lfeed .lgo").click()
                elif info["k"]=="practice":
                    if not wrong_practice_done and info["role"]:
                        pg.evaluate("""(role)=>{const b=[...document.querySelectorAll('[data-act=pcard]')].find(x=>x.dataset.v!==role);if(b)b.click()}""",info["role"])
                        assert "try again" in pg.locator(".lfeed").inner_text().lower(), "wrong practice tap not rejected"
                        wrong_practice_done=True
                    if info["role"]:
                        pg.evaluate("""(role)=>{document.querySelector('[data-act=pcard][data-v="'+role+'"]').click()}""",info["role"])
                        txt=pg.locator(".lfeed").inner_text()
                        assert "engine accepted" in txt.lower(), "practice not engine-accepted: "+txt[:160]
                        pg.locator(".lfeed .lgo").click()
                    else:
                        pg.locator(".llesson .lgo").first.click()
                        if pg.locator(".lfeed .lgo").count(): pg.locator(".lfeed .lgo").click()
                elif info["k"]=="mc":
                    pg.evaluate("""(ans)=>{const b=[...document.querySelectorAll('.lopt')].find(x=>x.dataset.v===ans);if(!b)throw new Error('mc answer btn missing');b.click()}""",info["answer"])
                    pg.locator(".lfeed .lgo").click()
                else:
                    raise AssertionError("unknown step "+str(info))
            assert pg.locator("text=Lesson complete").count(), "did not reach Lesson complete"
            per_ch[ch]+=1
        except Exception as e:
            fails.append(f"{lid}: {str(e).splitlines()[0][:220]}")
            print("FAIL",lid,str(e)[:220])
    cdp.send("Emulation.setCPUThrottlingRate",{"rate":1})
    for ch in sorted(per_ch_total): print(f"chapter {ch}: {per_ch[ch]}/{per_ch_total[ch]} lessons passed")
    print(f"lessons passed: {sum(per_ch.values())}/{len(ids)}")
    if errs: fails.append("JS errors: "+"; ".join(errs[:3])); print("JS errors",errs[:3])
    ctx.close(); b.close()
print("ui-learn-all:","FAILED "+str(len(fails))+" :: "+" | ".join(fails[:12]) if fails else "all passed")
sys.exit(1 if fails else 0)
