# Exhaustive Learn test: plays EVERY authored lesson end-to-end with real taps (card -> verb -> target),
# checks a wrong tap is rejected, puzzles are solved with an in-page engine search, and in EVERY UI state
# (step start, after a card is tapped, after a verb is picked, target picking, feedback toast, completion
# screen, path) checks all controls and badges for overlap / cover / clip / offscreen at 390x844, 375x667
# and 430x932, each with and without iPhone safe-area insets. Also image preload, emoji, 4x-CPU tap timing.
# Usage: python3 tests/ui-learn-all.py <url> [shotdir]
import sys, collections, os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from learnlib import CHECK, check_all, play_lesson
URL=sys.argv[1] if len(sys.argv)>1 else "http://127.0.0.1:8765/"
SHOT=sys.argv[2] if len(sys.argv)>2 else None
if SHOT: os.makedirs(SHOT,exist_ok=True)
fails=[]; per=collections.Counter(); tot=collections.Counter(); nchk=[0]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,device_scale_factor=2)
    pg=ctx.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(URL+"#learn"); pg.wait_for_selector(".ln",timeout=60000)
    cdp=ctx.new_cdp_session(pg); cdp.send("Emulation.setCPUThrottlingRate",{"rate":4})
    pg.evaluate("(id)=>LorcanaLearn._test.startLesson(id)","b2"); pg.wait_for_selector(".lboard",timeout=20000)
    perf=pg.evaluate("""()=>{const T=LorcanaLearn._test;const a=T.resolve({t:'ink',c:'STITCH'});const out=[];
      let t=performance.now();document.querySelector('.lt[data-uid="'+a.uid+'"]').click();out.push(performance.now()-t);
      t=performance.now();const v=document.querySelector('.lverb');v.click();out.push(performance.now()-t);
      t=performance.now();document.querySelector('[data-act=cancel],.lgo')&&0;return out.map(x=>Math.round(x*10)/10)}""")
    print("perf 4xCPU tap handlers ms:",perf)
    if max(perf)>=100: fails.append(f"perf {perf}")
    cdp.send("Emulation.setCPUThrottlingRate",{"rate":1})
    ids=pg.evaluate("()=>LorcanaLearn._test.flat().map(x=>[x.l.id,x.ci+1])")
    for lid,ch in ids:
        tot[ch]+=1
        try:
            pg.evaluate("(id)=>LorcanaLearn._test.startLesson(id)",lid); pg.wait_for_selector(".llesson .lprompt",timeout=20000)
            def chk(label):
                v=check_all(pg,label,nchk)
                assert v["n"]<=8 and v["small"] and v["lazy"] and v["loaded"], f"{label} images {v}"
                assert not v["emoji"], f"{label} emoji in DOM"
                return v
            play_lesson(pg,chk,SHOT,lid)
            per[ch]+=1
        except Exception as e:
            fails.append(f"{lid}: {str(e).splitlines()[0][:240]}"); print("FAIL",lid,str(e)[:240])
    for ch in sorted(tot): print(f"chapter {ch}: {per[ch]}/{tot[ch]} lessons passed")
    print(f"lessons passed: {sum(per.values())}/{len(ids)}")
    # path screen check + saved progress
    pg.evaluate("()=>{location.hash='';}"); pg.goto(URL+"#learn"); pg.wait_for_selector(".ln",timeout=30000)
    try: check_all(pg,"path",nchk)
    except AssertionError as e: fails.append(str(e))
    print("layout checks run:",nchk[0])
    if errs: fails.append("JS errors: "+"; ".join(errs[:3]))
    ctx.close(); b.close()
print("ui-learn-all:","FAILED "+str(len(fails))+" :: "+" | ".join(fails[:12]) if fails else "all passed")
sys.exit(1 if fails else 0)
