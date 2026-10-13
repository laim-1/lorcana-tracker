# UI: AI style picker, difficulty in opponent bar, end-turn confirm, lore race, inkable count.
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
fails = []
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    ctx.add_init_script("localStorage.setItem('lorcanaPlaySettings.v1','{\"level\":\"hard\",\"speed\":\"fast\",\"sound\":false,\"tips\":false,\"style\":\"aggro\"}');")
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL + "#play"); pg.wait_for_selector(".dopt", timeout=60000)
    # Style picker on menu
    if pg.locator("text=AI style").count() == 0: fails.append("no AI style heading")
    if pg.locator("[data-a=sty][data-v=aggro].on").count() == 0: fails.append("aggro style not selected")
    pg.tap("[data-a=sty][data-v=control]"); pg.wait_for_timeout(100)
    if pg.locator("[data-a=sty][data-v=control].on").count() == 0: fails.append("control style not selectable")
    # Start a game and check opponent bar + lore race + inkable chip
    pg.evaluate("()=>{const s=LorcanaPlay.state();s.deck='s0';s.opp='s1';s.mode='ai';LorcanaPlay.render()}")
    pg.wait_for_selector("[data-a=start]"); pg.tap("[data-a=start]")
    pg.wait_for_selector("[data-a=tomull]:not(.hidden)", timeout=8000); pg.tap("[data-a=tomull]")
    pg.wait_for_selector("[data-a=mdone]", timeout=8000); pg.tap("[data-a=mdone]")
    pg.wait_for_function("LorcanaPlay.state().screen==='board'", timeout=15000)
    # Wait until our turn (AI may go first)
    for _ in range(80):
        r = pg.evaluate("()=>{const S=LorcanaPlay.state(),st=S.st;if(!st||st.winner!=null)return'done';if(st.active===0&&!S.busy&&!st.pending)return'us';return'wait'}")
        if r in ("us", "done"): break
        pg.wait_for_timeout(200)
    bar = pg.locator("#lore-1").inner_text()
    if "HARD" not in bar.upper(): fails.append("difficulty missing in opponent bar: " + bar)
    if "CONTROL" not in bar.upper(): fails.append("personality missing in opponent bar: " + bar)
    if pg.locator("#inkable-0").count() == 0: fails.append("inkable chip missing")
    banner = pg.locator(".banner").inner_text()
    if "ahead" not in banner.lower() and "tied" not in banner.lower(): fails.append("lore race missing: " + banner)
    # End-turn confirm when legal actions remain: give ourselves a ready quester via engine
    pg.evaluate("""()=>{const S=LorcanaPlay.state(),st=S.st,E=window.LorcanaEngine;
      if(st.active!==0){st.active=0} // force our seat for the confirm UI check
      const c={uid:st.uid++,card:E.normCard({id:'q',name:'Q',type:['Character'],cost:1,inkwell:true,ink:'Amber',strength:2,willpower:5,lore:2}),owner:0,damage:0,exerted:false,playedOn:0,tStr:0,lStr:0,tLore:0,tChal:0,at:null,under:[],grants:[]};
      st.players[0].play.push(c); LorcanaPlay.render()}""")
    pg.wait_for_selector("[data-a=end]:not([disabled])", timeout=5000)
    pg.tap("[data-a=end]")
    pg.wait_for_selector("[data-a=endforce]", timeout=5000)
    if pg.locator("text=End your turn?").count() == 0: fails.append("end confirm sheet missing")
    pg.tap("[data-a=close]"); pg.wait_for_timeout(150)
    open_sheet = pg.evaluate("()=>document.getElementById('sheet').classList.contains('open')")
    if open_sheet: fails.append("confirm sheet did not close")
    if errs: fails.append("JS: " + "; ".join(errs[:3]))
    b.close()
print("ui-ai-style:", "FAILED " + "; ".join(fails) if fails else "passed")
sys.exit(1 if fails else 0)
