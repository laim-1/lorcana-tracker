# Batch 4: zoom acts visible, no leftover ghosts, banner not overlapping, long-press timing,
# pinch meta, double-tap guard, action log images, match history, goldfish mode.
import sys, time
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
fails = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    ctx.add_init_script("localStorage.setItem('lorcanaPlaySettings.v1','{\"level\":\"normal\",\"speed\":\"fast\",\"tips\":false,\"style\":\"balanced\"}')")
    ctx.add_init_script("localStorage.removeItem('lorcanaMatchHistory.v1')")
    pg = ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL + "#play"); pg.wait_for_selector(".dopt", timeout=90000)
    # viewport / pinch
    vp = pg.evaluate("()=>document.querySelector('meta[name=viewport]').content")
    if "maximum-scale=1" not in vp and "user-scalable=no" not in vp:
        fails.append(f"viewport missing pinch lock: {vp}")
    # #33 history button on menu
    if pg.locator("[data-a=history]").count() == 0:
        fails.append("history button missing on menu")
    # #37 goldfish mode option
    if pg.locator("[data-a=mode][data-v=gold]").count() == 0:
        fails.append("goldfish mode missing")
    pg.tap("[data-a=mode][data-v=gold]"); pg.wait_for_timeout(200)
    on = pg.evaluate("()=>document.querySelector('[data-a=mode][data-v=gold].on')!=null")
    if not on: fails.append("goldfish mode did not select")
    # start goldfish game
    pg.evaluate("()=>{const s=LorcanaPlay.state();s.deck='s0';s.opp='s1';s.mode='gold';LorcanaPlay.render()}")
    pg.tap("[data-a=start]"); pg.wait_for_selector("[data-a=tomull]:not(.hidden)", timeout=8000)
    pg.tap("[data-a=tomull]"); pg.wait_for_selector("[data-a=mdone]", timeout=8000)
    pg.tap("[data-a=mdone]")
    pg.wait_for_function("LorcanaPlay.state().screen==='board'", timeout=20000)
    # wait until our turn (goldfish may go first)
    for _ in range(80):
        r = pg.evaluate("()=>{const S=LorcanaPlay.state(),st=S.st;if(!st||st.winner!=null)return'done';if(st.active===0&&!S.busy&&!st.pending)return'us';return'wait'}")
        if r in ("us","done"): break
        pg.wait_for_timeout(150)
    # banner should say YOUR TURN or GOLDFISH
    ban = pg.locator(".banner b").inner_text()
    if "TURN" not in ban.upper(): fails.append(f"bad banner: {ban}")
    # #8 banner vs zones: banner bottom <= zone0 top + small slack; zone1 bottom <= banner top
    ov = pg.evaluate("""()=>{
      const b=document.querySelector('.banner'); const z0=document.querySelector('.z0'); const z1=document.querySelector('.z1');
      if(!b||!z0||!z1)return {ok:false,why:'missing'};
      const B=b.getBoundingClientRect(), A=z0.getBoundingClientRect(), C=z1.getBoundingClientRect();
      return {ok: C.bottom<=B.top+2 && B.bottom<=A.top+2, b:[Math.round(B.top),Math.round(B.bottom)], z0:[Math.round(A.top),Math.round(A.bottom)], z1:[Math.round(C.top),Math.round(C.bottom)]}}""")
    if not ov.get("ok"): fails.append(f"banner overlaps zones: {ov}")
    # #27 action log button
    if pg.locator("[data-a=alog]").count()==0: fails.append("alog button missing")
    else:
        pg.tap("[data-a=alog]"); pg.wait_for_timeout(250)
        if pg.locator(".alog, #sheet-body").count()==0: fails.append("alog sheet missing")
        # close
        if pg.locator("[data-a=close]").count(): pg.tap("[data-a=close]"); pg.wait_for_timeout(150)
    # #6 zoom acts never covered: select a hand card and check zacts in viewport bottom
    pg.evaluate("""()=>{const S=LorcanaPlay.state(),st=S.st,p=st.players[0];
      // put a cheap playable card in hand with ink
      while(p.ink.length<6&&p.deck.length){const x=p.deck.pop();x.exerted=false;p.ink.push(x)}
      p.inked=false; st.active=0; st.pending=null; S.sel=null; LorcanaPlay.render()}""")
    pg.wait_for_timeout(300)
    # pick first hand card
    hc = pg.locator(".hand2 .hc").first
    if hc.count():
        hc.tap(); pg.wait_for_timeout(400)
        # zoom should open with acts OR abar visible
        z = pg.evaluate("""()=>{
          const z=document.querySelector('.zoom'); if(!z) return {open:false};
          const acts=z.querySelector('.zacts'); if(!acts) return {open:true,hasActs:false};
          const A=acts.getBoundingClientRect(), H=innerHeight;
          const btns=[...acts.querySelectorAll('button')];
          const covered=btns.filter(b=>{const r=b.getBoundingClientRect();return r.bottom>H-2||r.top<0||r.height<40});
          return {open:true,hasActs:true,actsBottom:Math.round(A.bottom),vh:H,btnN:btns.length,covered:covered.length,
            minH:Math.min(...btns.map(b=>b.getBoundingClientRect().height))}}""")
        if not z.get("open"): fails.append("zoom did not open on hand tap")
        elif z.get("hasActs"):
            if z["covered"]: fails.append(f"zoom acts covered/offscreen: {z}")
            if z.get("minH",0)<44: fails.append(f"zoom act btn too small: {z}")
            if z["actsBottom"]>z["vh"]+1: fails.append(f"zacts below viewport: {z}")
        # close zoom
        if pg.locator(".zclose").count(): pg.tap(".zclose"); pg.wait_for_timeout(200)
    # #7 clearFx must scrub orphan animation copies on render
    orphans = pg.evaluate("""()=>{
      for(const cls of['ghost','tsweep','shuffle','ftext']){const g=document.createElement('div');g.className=cls;g.id='orphan-'+cls;document.body.appendChild(g)}
      LorcanaPlay.render();
      return [...document.querySelectorAll('#orphan-ghost,#orphan-tsweep,#orphan-shuffle,#orphan-ftext,.ghost#orphan-ghost')].length
        + [...document.querySelectorAll('body > .ghost, body > .tsweep, body > .shuffle, body > .ftext')].filter(e=>e.id&&e.id.startsWith('orphan-')).length}""")
    # After render(), injected orphans must be gone
    left = pg.evaluate("()=>[...document.querySelectorAll('body > .ghost, body > .tsweep, body > .shuffle, body > .ftext')].filter(e=>(e.id||'').startsWith('orphan-')).map(e=>e.id)")
    if left: fails.append(f"leftover animation copies after clearFx: {left}")
    # #11 long-press timing: pointerdown 320ms opens zoom
    pg.evaluate("()=>{const S=LorcanaPlay.state();S.sel=null;if(window.Zoom&&Zoom.isOpen())Zoom.close(true);LorcanaPlay.render()}")
    pg.wait_for_timeout(200)
    tile = pg.locator(".hand2 .hc").first
    if tile.count():
        box = tile.bounding_box()
        pg.touchscreen.tap(box["x"]+box["width"]/2, box["y"]+box["height"]/2)  # ensure no leftover
        # use pointer events for long press
        pg.evaluate("""(sel)=>{
          const el=document.querySelector(sel); const r=el.getBoundingClientRect();
          const x=r.left+r.width/2,y=r.top+r.height/2;
          el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:x,clientY:y,pointerId:1,pointerType:'touch'}));
        }""", ".hand2 .hc")
        pg.wait_for_timeout(360)
        opened = pg.evaluate("()=>!!(window.Zoom&&Zoom.isOpen())")
        if not opened: fails.append("long-press 360ms did not open zoom")
        pg.evaluate("""(sel)=>{
          const el=document.querySelector(sel);
          el&&el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1,pointerType:'touch'}));
          if(window.Zoom&&Zoom.isOpen())Zoom.close(true);
        }""", ".hand2 .hc")
    # #15 double-tap guard: same end button twice quickly — second should be ignored (no throw)
    pg.evaluate("""()=>{const S=LorcanaPlay.state();S._lastAct=null;S._tapLock=0;
      const b=document.querySelector('[data-a=end]'); if(!b)return;
      b.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      b.dispatchEvent(new MouseEvent('click',{bubbles:true}));}""")
    pg.wait_for_timeout(150)
    # close any confirm sheet from end-tap
    pg.evaluate("""()=>{const S=LorcanaPlay.state();const scr=document.getElementById('scrim');
      if(scr&&!scr.hidden){document.getElementById('sheet').classList.remove('open');scr.hidden=true;S.paused=false}}""")
    # Finish goldfish quickly: set lore win for player to test history recording
    pg.evaluate("""()=>{const S=LorcanaPlay.state(),st=S.st;st.players[0].lore=20;st.winner=0;st.phase='over';st.log.push('You reaches 20 lore and wins!');S.celebrated=false;LorcanaPlay.render()}""")
    pg.wait_for_timeout(400)
    if pg.locator(".modal.end").count()==0: fails.append("end screen missing after win")
    # history should have a row after recordMatch
    hist = pg.evaluate("()=>JSON.parse(localStorage.getItem('lorcanaMatchHistory.v1')||'[]')")
    if not hist: fails.append("match history not recorded")
    elif hist[0].get("mode")!="gold": fails.append(f"history mode wrong: {hist[0]}")
    # alog from end screen (force click via evaluate to avoid overlay races)
    opened = pg.evaluate("""()=>{const b=document.querySelector('.mbox [data-a=alog], [data-a=alog]');
      if(!b)return false; b.click(); return true}""")
    if not opened: fails.append("alog button missing on end screen")
    else:
        pg.wait_for_timeout(200)
        if pg.evaluate("()=>!document.getElementById('sheet').classList.contains('open')"):
            fails.append("alog sheet did not open from end screen")
    if errs: fails.extend("pageerror:"+e for e in errs[:5])
    b.close()
print("FAILS", len(fails))
for f in fails: print(" -", f)
sys.exit(1 if fails else 0)
