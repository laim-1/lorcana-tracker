# Batch 3: busy-board sizes, hand fan peek, exerted damage badges, hint button, last-played chip, concede sheet.
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
fails = []
BUSY = """(k)=>{const S=LorcanaPlay.state(),st=S.st;st.human=[true,false];
 const mv=(p,from,to,pred,n)=>{let c=0;for(let i=p[from].length-1;i>=0&&c<n;i--){const x=p[from][i];if(pred(x.card)){p[from].splice(i,1);x.exerted=false;x.dry=false;x.damage=0;p[to].push(x);c++}}};
 for(const p of st.players){mv(p,'deck','play',c=>c.type==='character',k==='max'?8:5);mv(p,'deck','play',c=>c.type==='item',2);mv(p,'deck','play',c=>c.type==='location',1);mv(p,'deck','ink',c=>true,6)}
 const p=st.players[0];while(p.hand.length<10&&p.deck.length){const x=p.deck.pop();x.exerted=false;p.hand.push(x)}
 p.play.filter(x=>x.card.type==='character').slice(0,4).forEach((x,i)=>{x.exerted=true;x.damage=1+(i%3)});
 st.players[1].play.filter(x=>x.card.type==='character').slice(0,2).forEach((x,i)=>{x.damage=1+i});
 st.active=0;st.pending=null;S.hint=false;S.lastOpp=null;LorcanaPlay.render()}"""
with sync_playwright() as p:
    b = p.chromium.launch()
    for size in [(375, 667), (390, 844)]:
        ctx = b.new_context(viewport={"width": size[0], "height": size[1]}, is_mobile=True, has_touch=True, device_scale_factor=2)
        ctx.add_init_script("localStorage.setItem('lorcanaPlaySettings.v1','{\"level\":\"normal\",\"speed\":\"fast\",\"tips\":false,\"style\":\"balanced\"}')")
        pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL + "#play"); pg.wait_for_selector(".dopt", timeout=60000)
        pg.evaluate("()=>{const s=LorcanaPlay.state();s.deck='s0';s.opp='s1';s.mode='ai';LorcanaPlay.render()}")
        pg.tap("[data-a=start]"); pg.wait_for_selector("[data-a=tomull]:not(.hidden)", timeout=8000)
        pg.tap("[data-a=tomull]"); pg.tap("[data-a=mdone]")
        pg.wait_for_function("LorcanaPlay.state().screen==='board'", timeout=15000)
        for _ in range(60):
            r = pg.evaluate("()=>{const S=LorcanaPlay.state(),st=S.st;if(!st||st.winner!=null)return'done';if(st.active===0&&!S.busy&&!st.pending)return'us';return'wait'}")
            if r in ("us", "done"): break
            pg.wait_for_timeout(200)
        pg.evaluate(BUSY, "busy"); pg.wait_for_timeout(700)
        # #2 character tiles tall enough / not vertically clipped in row
        info = pg.evaluate("""()=>{
          const rows=[...document.querySelectorAll('.row.chars')];
          const out={rows:[],hand:null,ex:[]};
          for(const r of rows){const R=r.getBoundingClientRect();const tiles=[...r.querySelectorAll('.ct')];
            let minH=999,clip=0;for(const t of tiles){const T=t.getBoundingClientRect();minH=Math.min(minH,T.height);
              if(T.top<R.top-2||T.bottom>R.bottom+2)clip++}
            out.rows.push({n:tiles.length,minH:Math.round(minH),clip,ch:getComputedStyle(r).getPropertyValue('--ch').trim(),crowded:document.querySelector('.gb').classList.contains('crowded')})}
          const hd=document.querySelector('.hand2');const cs=[...hd.children];
          const peeks=[];for(let i=0;i<cs.length;i++){const a=cs[i].getBoundingClientRect(),b=cs[i+1]?cs[i+1].getBoundingClientRect():null;
            peeks.push(b?Math.round(Math.max(0,b.left-a.left)):Math.round(a.width))}
          out.hand={n:cs.length,minPeek:Math.min(...peeks),peeks,big:hd.classList.contains('big')};
          for(const t of document.querySelectorAll('.ct.ex')){const T=t.getBoundingClientRect(),d=t.querySelector('.dtok');if(!d)continue;const D=d.getBoundingClientRect();
            out.ex.push({inside:D.left>=T.left-1&&D.right<=T.right+1&&D.top>=T.top-1&&D.bottom<=T.bottom+1,
              readable:D.width>=18&&D.height>=18,w:Math.round(D.width),top:Math.round(D.top-T.top),right:Math.round(T.right-D.right)})}
          return out}""")
        for r in info["rows"]:
            if r["n"] and r["minH"] < 56: fails.append(f"{size} char minH {r['minH']} too small")
            if r["clip"]: fails.append(f"{size} row clips {r['clip']} cards (ch={r['ch']})")
        if info["hand"]["n"] >= 8 and info["hand"]["minPeek"] < 42:
            fails.append(f"{size} hand minPeek {info['hand']['minPeek']} < 42 (want ~44)")
        if not info["ex"]: fails.append(f"{size} no exerted+damage samples")
        for e in info["ex"]:
            if not e["inside"]: fails.append(f"{size} exerted dtok outside card: {e}")
            if not e["readable"]: fails.append(f"{size} exerted dtok unreadable: {e}")
        # #28 Hint button
        if pg.locator("[data-a=hint]").count() == 0: fails.append(f"{size} hint button missing")
        else:
            pg.tap("[data-a=hint]"); pg.wait_for_timeout(300)
            hinted = pg.evaluate("()=>document.querySelectorAll('.hint').length")
            on = pg.evaluate("()=>document.querySelector('.hintbtn.on')!=null")
            if not on: fails.append(f"{size} hint btn not on")
            if hinted < 1: fails.append(f"{size} hint highlighted nothing")
            pg.tap("[data-a=hint]"); pg.wait_for_timeout(200)
            if pg.evaluate("()=>document.querySelector('.hintbtn.on')!=null"): fails.append(f"{size} hint did not toggle off")
        # #43 last played chip (simulate opponent play event)
        pg.evaluate("""()=>{const S=LorcanaPlay.state(),st=S.st,p=st.players[1];
          let x=p.hand[0];if(!x){x=p.deck.pop();p.hand.push(x)}
          p.hand=p.hand.filter(h=>h!==x);x.exerted=false;p.play.push(x);
          st.events=st.events||[];st.events.push({t:'play',pi:1,uid:x.uid,name:x.card.full});
          LorcanaPlay.render()}""")
        pg.wait_for_timeout(300)
        if pg.locator(".lastplay").count() == 0: fails.append(f"{size} last-play chip missing after opp play")
        # #45 concede confirmation sheet
        pg.tap("[data-a=pause]"); pg.wait_for_timeout(200)
        pg.tap("[data-a=concede]"); pg.wait_for_timeout(200)
        if pg.locator("[data-a=concedeok]").count() == 0: fails.append(f"{size} concede confirm missing")
        pg.tap("[data-a=pause]"); pg.wait_for_timeout(150)  # keep playing -> back to pause
        pg.tap("[data-a=resume]"); pg.wait_for_timeout(150)
        # #30 Game speed label in settings
        pg.tap("[data-a=pause]"); pg.wait_for_timeout(200)
        body = pg.locator("#sheet").inner_text()
        if "game speed" not in body.lower(): fails.append(f"{size} Game speed label missing in settings")
        pg.tap("[data-a=resume]")
        if errs: fails.append(f"{size} JS: " + "; ".join(errs[:3]))
        ctx.close()
    b.close()
print("ui-batch3:", "FAILED " + " | ".join(fails) if fails else "passed")
sys.exit(1 if fails else 0)
