# Picker sheet layout for every picker type + on-board target mode, WebKit and Chromium touch, 3 phone sizes.
# Usage: python3 tests/ui-picker.py <url> [--shots DIR]
import sys, re
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; SHOTS = sys.argv[sys.argv.index("--shots") + 1] if "--shots" in sys.argv else None
SRC = open(__file__.replace("ui-picker.py", "ui-layout.py")).read()
DETECT = SRC.split('DETECT = r"""')[1].split('"""')[0]
SIZES = [(390, 844), (375, 667), (430, 932)]
# Each case builds st.pending for the human seat; the picker is rendered from it exactly as in a game.
CASES = {
 "ask-text": "P=>({kind:'ask',pi:0,n:1,min:1,src:'Hakuna Matata',srcCard:P.h[0].card,why:'Hakuna Matata: Choose one',opts:[{label:'Remove up to 3 damage from chosen character'},{label:'Each opponent loses 1 lore and you gain 1 lore'},{label:'Draw 2 cards, then choose and discard a card'}]})",
 "ask-cards": "P=>({kind:'ask',pi:0,n:1,min:1,src:'Dragon Fire',why:'Choose a character to banish',opts:P.o.slice(0,7).map(x=>({uid:x.uid,card:x.card,owner:1,label:x.card.name}))})",
 "ask-cards-skip": "P=>({kind:'ask',pi:0,n:1,min:0,src:'Maleficent - Sorceress',why:'You may draw a card',opts:P.h.slice(0,2).map(x=>({uid:x.uid,card:x.card,owner:0}))})",
 "ask-multi": "P=>({kind:'ask',pi:0,n:3,min:0,src:'Grab Your Sword',why:'Choose up to 3 characters',opts:P.o.concat(P.m).slice(0,10).map((x,i)=>({uid:x.uid,card:x.card,owner:i<5?1:0,dis:i===4}))})",
 "ask-reveal": "P=>({kind:'ask',pi:0,n:1,min:1,reveal:true,src:'Dr. Facilier - Agent Provocateur',srcCard:P.h[0].card,why:'Opponent reveals their hand',opts:P.o.slice(0,8).map(x=>({uid:x.uid,card:x.card,owner:1}))})",
 "ask-longtext": "P=>({kind:'ask',pi:0,n:1,min:0,src:'Madam Mim - Up to No Good',srcCard:P.h[0].card,why:'Madam Mim - Up to No Good: Choose one of the following abilities to resolve now, or skip to keep things as they are this turn',opts:[{label:'Return a character card from your discard to your hand, then shuffle 2 cards from your hand into your deck'},{label:'Each opponent chooses and discards a card'},{label:'Banish chosen character with 3 strength or less and gain lore equal to its lore'},{label:'Ready chosen character of yours; it cannot quest for the rest of this turn'}]})",
 "dig": "P=>({kind:'dig',pi:0,top:P.d.slice(0,5).map(x=>x.uid),opts:P.d.slice(0,2).map(x=>x.uid),rest:'bottom',src:'Develop Your Brain',why:'Look at the top 5 cards'})",
 "free": "P=>({kind:'free',pi:0,opts:P.h.slice(0,4).map(x=>x.uid),src:'Pride Lands - Pride Rock',why:'Play a character for free'})",
 "discard": "P=>({kind:'discard',pi:0,n:2,src:'Sudden Chill',why:'Choose and discard 2 cards'})",
}
SETUP = """(code)=>{const S=LorcanaPlay.state(),st=S.st,p=st.players[0],o=st.players[1];st.human=[true,false];st.active=0;
 const mv=(pl,from,to,pred,n)=>{let c=0;for(let i=pl[from].length-1;i>=0&&c<n;i--){const x=pl[from][i];if(pred(x.card)){pl[from].splice(i,1);pl[to].push(x);c++}}};
 if(o.play.length<7)mv(o,'deck','play',c=>c.type==='character',7-o.play.length);if(p.play.length<5)mv(p,'deck','play',c=>c.type==='character',5-p.play.length);if(p.hand.length<9)mv(p,'deck','hand',()=>true,9-p.hand.length);
 const P={h:p.hand,o:o.play,m:p.play,d:p.deck};st.pending=(0,eval)(code)(P);S.pkMin=false;S.pkKey=null;LorcanaPlay.render()}"""
PK = r"""()=>{const pk=document.querySelector('.pk');if(!pk)return['NO-PICKER'];const out=[],R=pk.getBoundingClientRect();
 if(R.top<-1||R.bottom>innerHeight+1)out.push('PK-OUT-OF-VIEW '+Math.round(R.top)+'..'+Math.round(R.bottom));
 if(R.height>innerHeight*0.9)out.push('PK-TOO-TALL '+Math.round(R.height)+'/'+innerHeight);
 const s=getComputedStyle(pk);const scrolls=/auto|scroll/.test(s.overflowY);
 for(const b of pk.querySelectorAll('button')){if(b.offsetParent===null)continue;const r=b.getBoundingClientRect();
  if(r.right>R.right+1||r.left<R.left-1){let sc=false;for(let x=b.parentElement;x&&x!==pk;x=x.parentElement){if(/auto|scroll/.test(getComputedStyle(x).overflowX))sc=true}if(!sc)out.push('PK-BTN-OUTSIDE-X '+(b.dataset.a||b.className)+' '+Math.round(r.left)+'..'+Math.round(r.right))}
  if(r.bottom>R.bottom+1&&!scrolls)out.push('PK-BTN-CUT '+(b.dataset.a||b.className));
  if(r.height<40&&!b.classList.contains('pkz'))out.push('PK-SMALL '+(b.dataset.a||b.className)+' '+Math.round(r.height));
  if(b.classList.contains('pkz')&&(r.width<32||r.height<32))out.push('PK-ZOOMBTN-SMALL '+Math.round(r.width)+'x'+Math.round(r.height))}
 const act=pk.querySelector('.wide');if(act){pk.scrollTop=pk.scrollHeight;const r=act.getBoundingClientRect();const t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);if(!t||!act.contains(t))out.push('PK-ACTION-UNREACHABLE '+act.dataset.a);pk.scrollTop=0}
 for(const t of pk.querySelectorAll('.pkq,.pksub,.pksrc,.pkopt')){if(t.scrollWidth>t.clientWidth+2)out.push('PK-TEXT-OVERFLOW '+t.className+' '+t.scrollWidth+'>'+t.clientWidth)}
 const bar=pk.querySelector('.pkbar');if(bar){const r=bar.getBoundingClientRect();if(r.top<R.top-1)out.push('PK-BAR-ABOVE')}
 return out}"""
issues = {}
def note(k, v):
    if v: issues.setdefault(k, []).extend(v)
with sync_playwright() as pw:
    for eng in ("webkit", "chromium"):
        b = getattr(pw, eng).launch()
        for (w, h) in SIZES:
            kw = dict(viewport={"width": w, "height": h}, has_touch=True, device_scale_factor=2)
            if eng == "chromium": kw["is_mobile"] = True
            ctx = b.new_context(**kw); ctx.add_init_script("localStorage.setItem('lorcanaPlaySettings.v1','{\"level\":\"normal\",\"speed\":\"fast\",\"tips\":false}')")
            pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); tag = f"{eng} {w}x{h}"
            try:
                pg.goto(URL + "#play"); pg.wait_for_selector(".dopt", timeout=60000)
                pg.evaluate("const s=LorcanaPlay.state();s.deck='s0';s.opp='s9';LorcanaPlay.render()"); pg.click("[data-a=start]")
                pg.wait_for_selector("[data-a=tomull]:not(.hidden)", timeout=8000); pg.click("[data-a=tomull]"); pg.click("[data-a=mdone]")
                pg.wait_for_function("LorcanaPlay.state().screen==='board'", timeout=15000); pg.wait_for_timeout(1200)
                for name, code in CASES.items():
                    pg.evaluate(SETUP, code); pg.wait_for_timeout(1000)
                    note(f"{tag} {name}", pg.evaluate(PK)); note(f"{tag} {name} layout", [x for x in pg.evaluate(DETECT, name) if not x.startswith(("SELECT", "CALLOUT", "IMG-"))])
                    if SHOTS: pg.screenshot(path=f"{SHOTS}/pk-{eng}-{w}-{name}.png")
                    if pg.locator("[data-a=pkmin]").count():   # hide/show to see the board
                        pg.tap("[data-a=pkmin]"); pg.wait_for_timeout(300)
                        r = pg.evaluate("()=>{const pk=document.querySelector('.pk');const R=pk.getBoundingClientRect();return [R.height,!!document.querySelector('.pk.min')]}")
                        if not r[1] or r[0] > 90: note(f"{tag} {name}", [f"PK-MIN-BROKEN h={r[0]}"])
                        pg.tap("[data-a=pkmin]"); pg.wait_for_timeout(200)
                pg.evaluate("()=>{const S=LorcanaPlay.state();S.st.pending=null;LorcanaPlay.render()}")
                # on-board target mode, end to end: Control Your Temper! (chosen character gets -2 str) on an opposing character
                tm = pg.evaluate("""()=>{const S=LorcanaPlay.state(),st=S.st,p=st.players[0];st.human=[true,false];st.active=0;st.pending=null;
                  const all=[...p.deck,...p.discard,...p.hand];const x=all.find(c=>c.card.full==='Control Your Temper!');if(!x)return null;
                  for(const z of [p.deck,p.discard,p.hand]){const j=z.indexOf(x);if(j>=0)z.splice(j,1)}p.hand.push(x);p.ink.forEach(k=>k.exerted=false);while(p.ink.length<3)p.ink.push(p.deck.pop());S.sel=null;LorcanaPlay.render();return x.uid}""")
                if tm is None: note(tag + " target", ["no test card"])
                else:
                    pg.wait_for_timeout(500); pg.tap(f'.hand2 [data-uid="{tm}"]'); pg.wait_for_timeout(900)
                    pg.evaluate("()=>{const b=[...document.querySelectorAll('.zoom .ab')].find(b=>b.dataset.k==='play');b&&b.click()}"); pg.wait_for_timeout(900)
                    if not pg.locator(".banner.tm").count(): note(tag + " target", ["TARGET-MODE-NOT-SHOWN"])
                    else:
                        if SHOTS: pg.screenshot(path=f"{SHOTS}/tm-{eng}-{w}.png")
                        note(tag + " target layout", [x for x in pg.evaluate(DETECT, "tm") if not x.startswith(("SELECT", "CALLOUT", "IMG-"))])
                        t = pg.evaluate("""()=>{const ts=[...document.querySelectorAll('.tgt,.target,[data-a=tile].tg,[data-a=tile].can')].filter(e=>e.offsetParent);
                          const all=[...document.querySelectorAll('.zone.opp [data-a=tile], .opp [data-a=tile]')];return {n:ts.length,cls:ts.slice(0,2).map(e=>e.className),opp:all.length,ocls:all.slice(0,1).map(e=>e.className)}}""")
                        if not t["n"]: note(tag + " target", ["NO-HIGHLIGHTED-TARGETS " + str(t)])
                        else:
                            before = pg.evaluate("LorcanaPlay.state().st.players[0].hand.length")
                            sel = pg.evaluate("()=>{const e=[...document.querySelectorAll('.tgt,.target,[data-a=tile].tg,[data-a=tile].can')].find(e=>e.offsetParent);const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}")
                            pg.touchscreen.tap(sel[0], sel[1]); pg.wait_for_timeout(900)
                            after = pg.evaluate("[LorcanaPlay.state().st.players[0].hand.length, !!document.querySelector('.banner.tm')]")
                            if after[0] != before - 1 or after[1]: note(tag + " target", [f"TARGET-TAP-DID-NOT-RESOLVE hand {before}->{after[0]} banner={after[1]}"])
            except Exception as e:
                note(tag + " ERROR", [str(e).split("\n")[0][:200]])
            if errs: note(tag + " JS", errs[:3])
            ctx.close()
        b.close()
n = sum(len(v) for v in issues.values())
for k, v in issues.items():
    print("##", k); [print("  ", x) for x in sorted(set(v))]
print("ui-picker:", f"{n} issues" if n else "clean"); sys.exit(1 if n else 0)
