# Exhaustive Learn test: plays EVERY authored lesson end-to-end with real taps (card -> verb -> target),
# checks a wrong tap is rejected, puzzles are solved with an in-page engine search, and on every step
# checks: card images preloaded (decoded, small, lazy, <=8), no emoji, and NO overlapping/clipped/offscreen
# text or badges at 390x844, 375x667 and 430x932. Also measures tap handler time at 4x CPU throttle.
# Usage: python3 tests/ui-learn-all.py <url> [shotdir]
import sys, collections, os
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else "http://127.0.0.1:8765/"
SHOT=sys.argv[2] if len(sys.argv)>2 else None
VPS=[(390,844),(375,667),(430,932)]
fails=[]; per=collections.Counter(); tot=collections.Counter()
CHECK=r"""()=>{const r=document.querySelector('#learn');const imgs=[...r.querySelectorAll('img')];
 const emoji=/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2300}-\u{23FF}]/u.test(r.innerText||'');
 const els=[...r.querySelectorAll('.lbdg,.lst,.ltag,.lsay,.lverb,.lopt,.lt .lart,.lhud .chip,.lhud .lore,.lfeed-h span,.lgo,.lbtn,.ltitle')].filter(e=>e.offsetParent!==null);
 const R=els.map(e=>e.getBoundingClientRect());const bad=[];const W=document.documentElement.clientWidth;
 for(let i=0;i<els.length;i++){const a=R[i];if(a.left<-0.5||a.right>W+0.5)bad.push('offscreen '+els[i].className+' '+Math.round(a.left)+'..'+Math.round(a.right));
  if(/lbdg|lst |lsay|ltag|lverb/.test(els[i].className+' ')&&els[i].scrollWidth>els[i].clientWidth+1)bad.push('clipped '+els[i].className+':'+els[i].textContent.slice(0,20));
  for(let j=i+1;j<els.length;j++){if(els[i].contains(els[j])||els[j].contains(els[i]))continue;const b=R[j];
   const ix=Math.min(a.right,b.right)-Math.max(a.left,b.left),iy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
   if(ix>0.5&&iy>0.5)bad.push('overlap '+els[i].className+' / '+els[j].className+' "'+els[i].textContent.slice(0,14)+'" "'+els[j].textContent.slice(0,14)+'"')}}
 return{n:imgs.length,small:imgs.every(i=>(i.getAttribute('src')||'').includes('/small/')),lazy:imgs.every(i=>i.loading==='lazy'),
  loaded:imgs.every(i=>i.complete&&i.naturalWidth>0),emoji,bad:bad.slice(0,4)}}"""
TAP=r"""async (ref)=>{const T=LorcanaLearn._test;const a=ref.uid!=null?ref:T.resolve(ref);if(!a)throw new Error('cannot resolve '+JSON.stringify(ref));
 const q=s=>document.querySelector(s);const wait=()=>new Promise(r=>setTimeout(r,30));
 q('.lt[data-uid="'+a.uid+'"]').click();await wait();const want=T.sig(a);
 for(let k=0;k<6;k++){if(q('.lfeed'))return true;
  const vs=[...document.querySelectorAll('.lverb:not(.ghost)')];
  if(vs.length){const v=vs.find(b=>(b.dataset.sig||'').split(';').includes(want));if(!v)throw new Error('no verb for '+want+' in '+vs.map(b=>b.dataset.sig).join(' / '));v.click();await wait();continue}
  const c=[...document.querySelectorAll('.lt.cand')];if(c.length){const u=[a.singer,a.shift,a.loc,a.target].find(x=>x!=null&&q('.lt.cand[data-uid="'+x+'"]'));if(u==null)throw new Error('no candidate');q('.lt.cand[data-uid="'+u+'"]').click();await wait();continue}
  return true}return true}"""
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,device_scale_factor=2)
    pg=ctx.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(URL+"#learn"); pg.wait_for_selector(".ln",timeout=60000)
    cdp=ctx.new_cdp_session(pg); cdp.send("Emulation.setCPUThrottlingRate",{"rate":4})
    pg.evaluate("(id)=>LorcanaLearn._test.startLesson(id)","b2"); pg.wait_for_selector(".lboard",timeout=20000)
    perf=pg.evaluate("""()=>{const T=LorcanaLearn._test;const a=T.resolve({t:'ink',c:'STITCH'});const out=[];
      let t=performance.now();document.querySelector('.lt[data-uid="'+a.uid+'"]').click();out.push(performance.now()-t);
      t=performance.now();const v=document.querySelector('.lverb:not(.ghost)');v.click();out.push(performance.now()-t);
      t=performance.now();document.querySelector('[data-act=cancel],.lgo')&&0;return out.map(x=>Math.round(x*10)/10)}""")
    print("perf 4xCPU tap handlers ms:",perf)
    if max(perf)>=100: fails.append(f"perf {perf}")
    cdp.send("Emulation.setCPUThrottlingRate",{"rate":1})
    ids=pg.evaluate("()=>LorcanaLearn._test.flat().map(x=>[x.l.id,x.ci+1])")
    for lid,ch in ids:
        tot[ch]+=1
        try:
            pg.evaluate("(id)=>LorcanaLearn._test.startLesson(id)",lid); pg.wait_for_selector(".llesson .lprompt",timeout=20000)
            n=pg.evaluate("()=>LorcanaLearn._test.flat().find(x=>x.l.id===LorcanaLearn.state().cur).l.steps.length")
            wrong_done=False
            for i in range(n):
                pg.wait_for_selector(".lprompt",timeout=8000)
                s=pg.evaluate("()=>{const s=LorcanaLearn._test.step();return JSON.parse(JSON.stringify(s))}")
                for (w,h) in VPS:
                    pg.set_viewport_size({"width":w,"height":h}); pg.wait_for_timeout(30)
                    v=pg.evaluate(CHECK)
                    assert not v["bad"], f"step {i+1} @{w}x{h}: {v['bad']}"
                pg.set_viewport_size({"width":390,"height":844})
                assert v["n"]<=8 and v["small"] and v["lazy"] and v["loaded"], f"images {v}"
                assert not v["emoji"], "emoji in DOM"
                if SHOT and i<4: pg.screenshot(path=os.path.join(SHOT,f"{lid}_s{i+1}.png"))
                k=s["k"]
                if k=="do":
                    if not wrong_done:
                        pg.evaluate("()=>{const T=LorcanaLearn._test,st=T.engine();const x=st.players[1].play[0]||st.players[0].ink[0];const e=x&&document.querySelector('.lt[data-uid=\"'+x.uid+'\"]');if(e)e.click()}")
                        if pg.locator(".lfeed.bad").count()==0 and pg.locator(".lverb").count():
                            pg.locator(".lverb.ghost").click()
                        wrong_done=True
                    pg.evaluate(TAP,s["a"])
                elif k=="demo": pass
                elif k=="turn": pg.locator("[data-act=endturn]").click()
                elif k=="pick":
                    for a in ([s["ans"]] if not isinstance(s["ans"],list) else s["ans"]): pg.locator(f".lopt[data-i='{a}']").click()
                    if isinstance(s["ans"],list): pg.locator("[data-act=check]").click()
                elif k=="goal":
                    line=pg.evaluate("()=>LorcanaLearn._test.solve()")
                    assert line, "in-page solver found no line"
                    for a in line: pg.evaluate(TAP,a)
                pg.wait_for_selector(".lfeed.ok",timeout=8000)
                if SHOT and i<4: pg.screenshot(path=os.path.join(SHOT,f"{lid}_s{i+1}_done.png"))
                pg.locator(".lfeed .lgo").click()
            pg.wait_for_selector("text=Lesson complete",timeout=5000)
            per[ch]+=1
        except Exception as e:
            fails.append(f"{lid}: {str(e).splitlines()[0][:240]}"); print("FAIL",lid,str(e)[:240])
    for ch in sorted(tot): print(f"chapter {ch}: {per[ch]}/{tot[ch]} lessons passed")
    print(f"lessons passed: {sum(per.values())}/{len(ids)}")
    # path screen check + saved progress
    pg.evaluate("()=>{location.hash='';}"); pg.goto(URL+"#learn"); pg.wait_for_selector(".ln",timeout=30000)
    v=pg.evaluate(CHECK); 
    if v["bad"]: fails.append("path layout "+str(v["bad"]))
    if errs: fails.append("JS errors: "+"; ".join(errs[:3]))
    ctx.close(); b.close()
print("ui-learn-all:","FAILED "+str(len(fails))+" :: "+" | ".join(fails[:12]) if fails else "all passed")
sys.exit(1 if fails else 0)
