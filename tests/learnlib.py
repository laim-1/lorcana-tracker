# Shared helpers for the Learn UI tests.
# CHECK covers EVERY visible interactive control and text badge (buttons, [data-act], action bars, pickers,
# feedback toasts, completion screens), including position:fixed ones (offsetParent is null for those, which
# is why the old filter skipped them). Three checks: pairwise box overlap, off-screen/clipped, and a hit test
# (the control's centre must reach the control itself, so nothing may sit on top of it).
VPS=[(390,844),(375,667),(430,932)]
INSETS=[None,{"t":47,"b":34,"l":0,"r":0}]   # none, iPhone notch / home-indicator safe areas
CHECK=r"""()=>{const r=document.querySelector('#learn');r.scrollTop=0;const imgs=[...r.querySelectorAll('img')];
 const emoji=/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2300}-\u{23FF}]/u.test(r.innerText||'');
 const vis=e=>{if(!e.getClientRects().length)return false;const cs=getComputedStyle(e);return cs.visibility!=='hidden'&&cs.display!=='none'&&+cs.opacity>0};
 const SEL='button,a[href],input,select,textarea,[data-act],[role=button],[role=status],.lverbs,.lfeed,.lbdg,.lst,.ltag,.lsay,.lopt,.lt .lart,.lhud .chip,.lhud .lore,.lfeed-h span,.ltitle,.lbig,.llesson h2,.ltext';
 const scope=[...document.querySelectorAll('#learn '+SEL.split(',').join(',#learn ')),...[...document.body.children].filter(e=>e.id!=='learn'&&vis(e)&&getComputedStyle(e).position==='fixed'&&+getComputedStyle(e).zIndex>=18&&(r=>r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth)(e.getBoundingClientRect()))];
 const els=scope.filter(vis);const R=els.map(e=>e.getBoundingClientRect());const bad=[];const W=document.documentElement.clientWidth,H=document.documentElement.clientHeight;
 const nm=e=>(e.className&&e.className.baseVal===undefined?e.className:e.tagName)+':"'+(e.textContent||'').trim().slice(0,14)+'"';
 for(let i=0;i<els.length;i++){const a=R[i];if(a.width<1||a.height<1)continue;
  if(a.left<-0.5||a.right>W+0.5)bad.push('offscreen '+nm(els[i]));
  if(/lbdg|lst |lsay|ltag|lverb|lcancel|lgo|lbtn|lopt/.test(els[i].className+' ')&&els[i].scrollWidth>els[i].clientWidth+1)bad.push('clipped '+nm(els[i]));
  for(let j=i+1;j<els.length;j++){if(els[i].contains(els[j])||els[j].contains(els[i]))continue;const b=R[j];
   const ix=Math.min(a.right,b.right)-Math.max(a.left,b.left),iy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
   if(ix>0.5&&iy>0.5)bad.push('overlap '+nm(els[i])+' / '+nm(els[j]))}}
 const ctl=els.filter(e=>e.matches('button,a[href],input,select,[data-act],[role=button]'));
 for(const e of ctl){let b=e.getBoundingClientRect();if(b.width<1)continue;
  if(b.top<0||b.bottom>H){e.scrollIntoView({block:'center'});b=e.getBoundingClientRect()}
  const bar=r.querySelector('.lbar');const top=bar&&!bar.contains(e)?bar.getBoundingClientRect().bottom:0;
  if(b.bottom<=top||b.top>=H)continue;const y=Math.max(b.top+b.height/2,top+2);const h=document.elementFromPoint(b.left+b.width/2,Math.min(y,H-1));
  if(h&&!e.contains(h)&&!h.contains(e))bad.push('covered '+nm(e)+' by '+nm(h));
  if(b.height<40&&e.matches('button'))bad.push('small tap target '+nm(e)+' '+Math.round(b.height))}
 r.scrollTop=0;
 return{n:imgs.length,small:imgs.every(i=>(i.getAttribute('src')||'').includes('/small/')),lazy:imgs.every(i=>i.loading==='lazy'),
  loaded:imgs.every(i=>i.complete&&i.naturalWidth>0),emoji,bad:[...new Set(bad)].slice(0,5)}}"""

def set_insets(pg,ins):
    pg.evaluate("""(i)=>{const r=document.querySelector('#learn');for(const k of 'tblr')r.style.removeProperty('--sa'+k);
      if(i)for(const k of 'tblr')r.style.setProperty('--sa'+k,i[k]+'px')}""",ins)

def check_all(pg,label,counter=None):
    """Run CHECK at all 3 sizes x (no insets, iPhone safe-area insets). Raises on any hit."""
    v=None
    for ins in INSETS:
        set_insets(pg,ins)
        for (w,h) in VPS:
            pg.set_viewport_size({"width":w,"height":h}); pg.wait_for_timeout(25)
            v=pg.evaluate(CHECK)
            if counter is not None: counter[0]+=1
            assert not v["bad"], f"{label} @{w}x{h}{' +insets' if ins else ''}: {v['bad']}"
    set_insets(pg,None); pg.set_viewport_size({"width":390,"height":844})
    return v

# One UI transition per call so the caller can run check_all() between taps:
# card tapped -> verb bar open -> (verb picked) -> target candidates -> applied.
TAP1=r"""async (ref)=>{const T=LorcanaLearn._test;const q=s=>document.querySelector(s);const wait=()=>new Promise(r=>setTimeout(r,30));
 const key=JSON.stringify(ref);let S=window.__tp;
 if(!S||S.key!==key){const a=ref.uid!=null?ref:T.resolve(ref);if(!a)throw new Error('cannot resolve '+key);
  S=window.__tp={key,a,want:T.sig(a),q:(a.target!=null?[a.target]:[a.singer,a.shift,a.loc]).filter(x=>x!=null),n:0};
  const e=q('.lt[data-uid="'+a.uid+'"]');if(!e)throw new Error('no card '+a.uid);e.click();await wait();return 'more'}
 if(++S.n>8)throw new Error('tap loop');
 if(q('.lfeed')){window.__tp=null;return 'done'}
 const vs=[...document.querySelectorAll('.lverb')];
 if(vs.length){const v=vs.find(b=>(b.dataset.sig||'').split(';').includes(S.want));if(!v)throw new Error('no verb for '+S.want+' in '+vs.map(b=>b.dataset.sig).join(' / '));v.click();await wait();return 'more'}
 if(document.querySelectorAll('.lt.cand').length){const i=S.q.findIndex(x=>q('.lt.cand[data-uid="'+x+'"]'));if(i<0)throw new Error('no candidate');q('.lt.cand[data-uid="'+S.q.splice(i,1)[0]+'"]').click();await wait();return 'more'}
 window.__tp=null;return 'done'}"""

def tap(pg,a,check=None,label=""):
    pg.evaluate("()=>{window.__tp=null}")
    while pg.evaluate(TAP1,a)=='more':
        if check: check(label)

def play_lesson(pg,check=None,shot=None,lid="",wrong=True):
    """Play the open lesson to its completion screen with real taps. check(label) is run in every state."""
    n=pg.evaluate("()=>LorcanaLearn._test.flat().find(x=>x.l.id===LorcanaLearn.state().cur).l.steps.length")
    wrong_done=not wrong; last=None
    for i in range(n):
        pg.wait_for_selector(".lprompt",timeout=8000)
        s=pg.evaluate("()=>{const s=LorcanaLearn._test.step();return JSON.parse(JSON.stringify(s))}")
        lab=f"{lid} step {i+1}"
        if check: last=check(lab)
        if shot and i<4: pg.screenshot(path=f"{shot}/{lid}_s{i+1}.png")
        k=s["k"]
        if k=="do":
            if not wrong_done:
                pg.evaluate("()=>{const T=LorcanaLearn._test,st=T.engine();const x=st.players[1].play[0]||st.players[0].ink[0];const e=x&&document.querySelector('.lt[data-uid=\"'+x.uid+'\"]');if(e)e.click()}")
                if check: check(lab+" wrong-tap")
                if pg.locator(".lfeed.bad").count()==0 and pg.locator(".lcancel").count(): pg.locator(".lcancel").click()
                wrong_done=True
            tap(pg,s["a"],check,lab+" tap")
        elif k=="demo": pass
        elif k=="turn": pg.locator("[data-act=endturn]").click()
        elif k=="pick":
            ans=[s["ans"]] if not isinstance(s["ans"],list) else s["ans"]
            for a in ans:
                pg.locator(f".lopt[data-i='{a}']").click()
                if check and isinstance(s["ans"],list): check(lab+" picked")
            if isinstance(s["ans"],list): pg.locator("[data-act=check]").click()
        elif k=="goal":
            line=pg.evaluate("()=>LorcanaLearn._test.solve()")
            assert line, "in-page solver found no line"
            for a in line: tap(pg,a,check,lab+" puzzle")
        pg.wait_for_selector(".lfeed.ok",timeout=8000)
        if check: check(lab+" feedback")
        if shot and i<4: pg.screenshot(path=f"{shot}/{lid}_s{i+1}_done.png")
        pg.locator(".lfeed .lgo").click()
    pg.wait_for_selector("text=Lesson complete",timeout=5000)
    if check: check(lid+" complete screen")
    return last
