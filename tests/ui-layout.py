# Layout regression hunt: overlapping interactive elements, covered controls, off-screen content, clipped text,
# native long-press callout settings. Runs WebKit (iOS-like) and Chromium touch at 390x844, 375x667, 430x932.
# Usage: python3 tests/ui-layout.py <url> [--shots DIR] [--engines webkit,chromium]
import sys, json, os
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; SHOTS = sys.argv[sys.argv.index("--shots") + 1] if "--shots" in sys.argv else None
ENG = (sys.argv[sys.argv.index("--engines") + 1] if "--engines" in sys.argv else "webkit,chromium").split(",")
SIZES = [(390, 844), (375, 667), (430, 932)]
DETECT = r"""(name)=>{const out=[];const vis=e=>{if(!e.isConnected)return false;const r=e.getBoundingClientRect();if(r.width<2||r.height<2)return false;
 for(let x=e;x;x=x.parentElement){const s=getComputedStyle(x);if(s.display==='none'||s.visibility==='hidden'||+s.opacity===0)return false}return r.bottom>0&&r.top<innerHeight};
 const layers=[...document.querySelectorAll('.zoom,#sheet,.sheet,.pk:not(.min),#play')].filter(vis);
 const z=e=>{let v=0;for(let x=e;x&&x!==document.body;x=x.parentElement){const s=getComputedStyle(x);if(s.position!=='static'&&s.zIndex!=='auto')v=Math.max(v,+s.zIndex)}return v};
 layers.sort((a,b)=>z(b)-z(a));const root=layers[0]||document.body;
 const modal=root.querySelector('.modal,.pk:not(.min),.sheet.open');
 const I=[...root.querySelectorAll('button,a[href],input,select,[data-a]')].filter(vis).filter(e=>!modal||modal.contains(e));
 const lab=e=>(e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.dataset.a?'[data-a='+e.dataset.a+']':'')+'.'+[...e.classList].slice(0,2).join('.')+' "'+(e.innerText||e.value||e.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim().slice(0,18)+'"');
 const stk=e=>{for(let x=e;x&&x!==document.body;x=x.parentElement){const p=getComputedStyle(x).position;if(p==='sticky'||p==='fixed')return x!==root||root.id!=='play'?x:null}return null};
 const fan=e=>e.closest('.hand2,.fan,.stack,.ustack,.pile,.items.col');
 for(let i=0;i<I.length;i++)for(let j=i+1;j<I.length;j++){const a=I[i],b=I[j];if(a.contains(b)||b.contains(a))continue;if(!!stk(a)!==!!stk(b))continue;if(fan(a)&&fan(a)===fan(b))continue;
  const A=a.getBoundingClientRect(),B=b.getBoundingClientRect();const w=Math.min(A.right,B.right)-Math.max(A.left,B.left),h=Math.min(A.bottom,B.bottom)-Math.max(A.top,B.top);
  if(w>3&&h>3&&w*h>0.12*Math.min(A.width*A.height,B.width*B.height))out.push('OVERLAP '+lab(a)+' <> '+lab(b)+' '+Math.round(w)+'x'+Math.round(h))}
 for(const e of I){const r=e.getBoundingClientRect();if(r.right>innerWidth+1.5||r.left<-1.5){let sc=false;for(let x=e.parentElement;x;x=x.parentElement){const s=getComputedStyle(x);if(/auto|scroll/.test(s.overflowX)&&x.scrollWidth>x.clientWidth){sc=true;break}}if(!sc)out.push('OFFSCREEN-X '+lab(e)+' '+Math.round(r.left)+'..'+Math.round(r.right))}
  const cx=Math.min(innerWidth-1,Math.max(0,r.left+r.width/2)),cy=r.top+r.height/2;if(cy<0||cy>innerHeight)continue;const t=document.elementFromPoint(cx,cy);
  if(t&&!e.contains(t)&&!t.contains(e)){const tm=modal&&modal.contains(t)&&!modal.contains(e)||(!stk(e)&&stk(t));const fx=t.closest('canvas,.fxl,#fx,.ghost,.flyg,.shard');
   if(!tm&&!(fan(e)&&fan(e)===fan(t)))out.push((fx?'COVERED-BY-FX ':'COVERED ')+lab(e)+' by '+lab(t))}}
 for(const e of root.querySelectorAll('button,h1,h2,h3,h4,.ptitle,.meta,.chip,label,.opt,.dopt *,.cname,.lbl,.stat,.pill')){if(!vis(e)||!e.childNodes.length)continue;const s=getComputedStyle(e);
  if(e.scrollWidth>e.clientWidth+2&&s.textOverflow!=='ellipsis'&&/hidden|clip/.test(s.overflowX)&&e.innerText.trim())out.push('CLIPPED-TEXT '+lab(e)+' '+e.scrollWidth+'>'+e.clientWidth);
  if(/hidden|clip/.test(s.overflowY)&&e.innerText.trim()&&s.webkitLineClamp==='none'){const rg=document.createRange();rg.selectNodeContents(e);const T=rg.getBoundingClientRect(),R=e.getBoundingClientRect();if(T.height&&(T.top<R.top-2||T.bottom>R.bottom+2))out.push('CLIPPED-TEXT-V '+lab(e)+' '+Math.round(T.height)+'>'+Math.round(R.height))}}
 const lum=c=>{const m=c.match(/[\d.]+/g);if(!m)return null;const [r,g,b]=m.slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b};
 for(const e of I){if(!(e.innerText||'').trim())continue;const s=getComputedStyle(e);let bg=null;for(let x=e;x;x=x.parentElement){const c=getComputedStyle(x);if(c.backgroundImage!=='none'&&x!==e){break}if(!/rgba\(.*, 0\)|transparent/.test(c.backgroundColor)){bg=c.backgroundColor;break}}
  if(s.backgroundImage==='none'&&bg){const L1=lum(s.color),L2=lum(bg);if(L1!=null&&L2!=null){const cr=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);if(cr<2.5)out.push('LOW-CONTRAST '+lab(e)+' '+cr.toFixed(1))}}
  if(s.backgroundImage!=='none'&&/gradient/.test(s.backgroundImage)&&lum(s.color)<.05&&/rgba\([^)]*0\.[0-3]\d*\)/.test(s.backgroundImage))out.push('LOW-CONTRAST '+lab(e)+' dark text on translucent gradient')}
 const fg=document.getElementById('fx-fg');if(fg){const zf=+getComputedStyle(fg).zIndex;for(const m of document.querySelectorAll('.modal,.sheet,.pk,.zoom')){if(vis(m)&&z(m)>=0&&zf>=z(m))out.push('FX-ABOVE-MODAL '+lab(m))}}
 if(document.documentElement.scrollWidth>innerWidth+1)out.push('PAGE-HSCROLL '+document.documentElement.scrollWidth);
 const b=getComputedStyle(document.body);if((b.webkitTouchCallout||'none')!=='none')out.push('CALLOUT body touch-callout='+b.webkitTouchCallout);
 if(!/none/.test(b.webkitUserSelect||b.userSelect))out.push('SELECT body user-select='+(b.webkitUserSelect||b.userSelect));
 const im=[...document.images].filter(i=>i.draggable!==false||!/none/.test(getComputedStyle(i).webkitUserDrag||'none'));if(im.length)out.push('IMG-DRAGGABLE '+im.length);
 return [...new Set(out)]}"""
BUSY = r"""(k)=>{const S=LorcanaPlay.state(),st=S.st,E=window.LorcanaEngine;st.human=[false,false];
 const mv=(p,from,to,pred,n)=>{let c=0;for(let i=p[from].length-1;i>=0&&c<n;i--){const x=p[from][i];if(pred(x.card)){p[from].splice(i,1);x.exerted=false;x.dry=false;x.damage=0;p[to].push(x);c++}}};
 for(const p of st.players){const dk=p.deck;if(k==='busy'){mv(p,'deck','play',c=>c.type==='character',6);mv(p,'deck','play',c=>c.type==='item',3);mv(p,'deck','play',c=>c.type==='location',2);mv(p,'deck','ink',c=>true,8)}
  if(k==='max'){mv(p,'deck','play',c=>c.type==='character',9);mv(p,'deck','play',c=>c.type==='item',5);mv(p,'deck','play',c=>c.type==='location',3);mv(p,'deck','ink',c=>true,12);mv(p,'deck','discard',c=>true,10)}}
 if(k!=='early'){const p=st.players[0];mv(p,'deck','hand',c=>true,k==='max'?6:3);st.players[0].play.slice(0,3).forEach(x=>x.exerted=true);st.players[1].play.slice(0,2).forEach((x,i)=>x.damage=1+i)}
 st.players[0].lore=17;st.players[1].lore=19;st.active=0;LorcanaPlay.render()}"""
issues = {}
LAST = [""]
def rec(eng, size, scr, pg, shots):
    LAST[0] = scr
    r = pg.evaluate(DETECT, scr)
    key = f"{eng} {size[0]}x{size[1]} {scr}"
    if r: issues[key] = r
    if shots: pg.screenshot(path=f"{shots}/{eng}-{size[0]}-{scr}.png")
with sync_playwright() as p:
    for eng in ENG:
        bt = getattr(p, eng).launch()
        for size in SIZES:
            kw = dict(viewport={"width": size[0], "height": size[1]}, has_touch=True, device_scale_factor=2)
            if eng == "chromium": kw["is_mobile"] = True
            ctx = bt.new_context(**kw); ctx.add_init_script("localStorage.setItem('lorcanaPlaySettings.v1','{\"level\":\"normal\",\"speed\":\"fast\",\"tips\":false}')")
            pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            try:
                pg.goto(URL); pg.wait_for_selector(".set", timeout=60000); pg.wait_for_timeout(700); rec(eng, size, "home", pg, SHOTS)
                pg.locator(".set").first.click(); pg.wait_for_timeout(1500); rec(eng, size, "setview", pg, SHOTS)
                pg.evaluate("window.scrollTo(0,600)"); pg.wait_for_timeout(300); rec(eng, size, "setview-scrolled", pg, SHOTS)
                pg.goto(URL + "#play"); pg.wait_for_selector(".dopt", timeout=60000); pg.wait_for_timeout(500); rec(eng, size, "decks", pg, SHOTS)
                pg.evaluate("document.querySelector('#play').scrollTop=99999"); pg.wait_for_timeout(300); rec(eng, size, "decks-bottom", pg, SHOTS)
                pg.evaluate("document.querySelector('#play').scrollTop=0")
                if pg.locator("[data-a=builder]").count():
                    pg.locator("[data-a=builder]").first.click(); pg.wait_for_timeout(1200); rec(eng, size, "builder", pg, SHOTS)
                    pg.evaluate("for(const b of [...document.querySelectorAll('[data-a=badd]')].slice(0,20))b.click()"); pg.wait_for_timeout(400); rec(eng, size, "builder-filled", pg, SHOTS)
                pg.evaluate("const s=LorcanaPlay.state();s.screen='menu';s.st=null;s.deck='s3';s.opp='s9';LorcanaPlay.render()")
                pg.click("[data-a=start]"); pg.wait_for_timeout(400); rec(eng, size, "coin", pg, SHOTS)
                pg.wait_for_selector("[data-a=tomull]:not(.hidden)", timeout=8000); pg.click("[data-a=tomull]"); pg.wait_for_timeout(400); rec(eng, size, "mulligan", pg, SHOTS)
                pg.click("[data-a=mdone]"); pg.wait_for_function("LorcanaPlay.state().screen==='board'", timeout=15000); pg.wait_for_timeout(1500)
                pg.evaluate("LorcanaPlay.state().st.active=0;LorcanaPlay.render()"); pg.wait_for_timeout(800); rec(eng, size, "board-early", pg, SHOTS)
                lp = pg.evaluate("""async()=>{const t=document.querySelector('.hand2 [data-a=tile],[data-a=tile]');if(!t)return 'no tile';const r=t.getBoundingClientRect(),o={bubbles:true,pointerType:'touch',isPrimary:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2};
                  t.dispatchEvent(new PointerEvent('pointerdown',o));const cm=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});t.dispatchEvent(cm);await new Promise(z=>setTimeout(z,700));t.dispatchEvent(new PointerEvent('pointerup',o));
                  const open=!!document.querySelector('.zoom');const q=document.querySelector('#q');const qs=q?getComputedStyle(q).webkitUserSelect||getComputedStyle(q).userSelect:'text';
                  if(window.Zoom)Zoom.close();return (open?'':'long-press did not open zoom; ')+(cm.defaultPrevented?'':'contextmenu not prevented; ')+(/text|auto/.test(qs)?'':'search input not selectable')}""")
                if lp: issues.setdefault(f"{eng} {size[0]}x{size[1]} longpress", []).append(lp)
                pg.wait_for_timeout(500)
                for k in ("busy", "max"):
                    pg.evaluate(BUSY, k); pg.wait_for_timeout(900); rec(eng, size, "board-" + k, pg, SHOTS)
                t = pg.locator(".mine [data-a=tile], [data-a=tile]").first
                if t.count():
                    t.click(); pg.wait_for_timeout(900); rec(eng, size, "zoom-actions", pg, SHOTS)
                    pg.evaluate("window.Zoom&&Zoom.close()"); pg.wait_for_timeout(500)
                pg.evaluate("document.querySelector('[data-a=pause]')&&document.querySelector('[data-a=pause]').click()"); pg.wait_for_timeout(500); rec(eng, size, "pause-menu", pg, SHOTS)
                pg.evaluate("document.querySelector('[data-a=resume]')&&document.querySelector('[data-a=resume]').click()"); pg.wait_for_timeout(400)
                pg.evaluate("document.querySelector('[data-a=bview]')&&document.querySelector('[data-a=bview]').click()"); pg.wait_for_timeout(500); rec(eng, size, "discard-view", pg, SHOTS)
                pg.evaluate("document.querySelector('[data-a=close],[data-a=cancel]')&&document.querySelector('[data-a=close],[data-a=cancel]').click()"); pg.wait_for_timeout(300)
                # picker: a "choose up to / chosen" action played by the human through the real zoom -> Play flow
                ok = pg.evaluate("""()=>{const S=LorcanaPlay.state(),st=S.st,p=st.players[0];const pool=window.LorcanaEngine;st.human=[true,false];st.active=0;st.pending=null;
                  const all=[...p.deck,...p.discard];const isA=x=>(x.card.type==='action'||x.card.type==='song')&&x.card.cost<=6;let i=all.findIndex(x=>isA(x)&&/choose one/i.test(x.card.text));if(i<0)i=all.findIndex(x=>isA(x)&&/chosen|choose/i.test(x.card.text));if(i<0)return false;
                  const x=all[i];for(const z of [p.deck,p.discard]){const j=z.indexOf(x);if(j>=0)z.splice(j,1)}p.hand.push(x);p.ink.forEach(k=>k.exerted=false);S.sel=null;LorcanaPlay.render();return x.uid}""")
                if ok:
                    pg.wait_for_timeout(600); pg.evaluate("u=>{const e=document.querySelector('[data-uid=\"'+u+'\"],[data-zuid=\"'+u+'\"]')||[...document.querySelectorAll('.hand2 [data-a=tile]')].pop();e&&e.click()}", ok); pg.wait_for_timeout(900)
                    pg.evaluate("()=>{const b=[...document.querySelectorAll('.zoom .ab')].find(b=>/play/i.test(b.dataset.k||b.innerText));b&&b.click()}"); pg.wait_for_timeout(900)
                    if pg.locator(".pk").count(): rec(eng, size, "picker", pg, SHOTS)
                    elif pg.locator(".banner.tm").count(): rec(eng, size, "target-mode", pg, SHOTS)
                    pg.evaluate("()=>{const S=LorcanaPlay.state();S.st.human=[false,false];S.st.pending=null;LorcanaPlay.render()}"); pg.wait_for_timeout(400)
                pg.evaluate("const st=LorcanaPlay.state().st;st.winner=0;st.players[0].lore=20;LorcanaPlay.render()"); pg.wait_for_timeout(2500); rec(eng, size, "end", pg, SHOTS)
            except Exception as e:
                issues[f"{eng} {size[0]}x{size[1]} ERROR after {LAST[0]}"] = [str(e).split("\n")[0][:200]]
            if errs: issues[f"{eng} {size[0]}x{size[1]} JS"] = errs[:3]
            ctx.close()
        bt.close()
n = sum(len(v) for v in issues.values())
for k, v in issues.items():
    print("##", k); [print("  ", x) for x in v]
print("ui-layout:", f"{n} issues" if n else "clean"); sys.exit(1 if n else 0)
