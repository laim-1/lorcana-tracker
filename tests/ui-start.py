# Regression: deck screen -> Start must work on touch phones with fresh AND old/corrupt saved data.
# Usage: python3 tests/ui-start.py <url>   (uses real touchscreen taps at on-screen coordinates; no auto-scroll)
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
OLD = """localStorage.setItem('lorcanaPlaySettings.v1','{"level":"bogus","speed":7,"tips":"x"}');
localStorage.setItem('lorcanaDecks.v1',JSON.stringify([{name:'Old',cards:{'crd_x':4}},{name:null},null,'bad',{name:'A',cards:null}]));
localStorage.setItem('lorcanaFx.v1','{"low":"yes"}');localStorage.setItem('lorcanaSort.v2','{"sets":"bogus","cards":"zzz"}');
localStorage.setItem('lorcanaCollection.v1','{"a":null,"b":{"n":"2"}}');"""
fails = []
def tap_visible(pg, sel, what):
    r = pg.evaluate("""s=>{const e=[...document.querySelectorAll(s)].find(x=>x.offsetParent);if(!e)return null;const r=e.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;const t=document.elementFromPoint(cx,cy);return {cx,cy,in:r.top>=0&&r.bottom<=innerHeight,hit:!!t&&(t===e||e.contains(t)),h:r.height,dis:e.disabled}}""", sel)
    if not r: raise Exception(what + " not found")
    if not r["in"]: raise Exception(what + " is off-screen")
    if not r["hit"]: raise Exception(what + " is covered by another element")
    if r["h"] < 44: raise Exception(what + " smaller than 44px")
    if r["dis"]: raise Exception(what + " disabled")
    pg.touchscreen.tap(r["cx"], r["cy"])
with sync_playwright() as p:
    b = p.chromium.launch()
    for (w, h) in [(390, 844), (360, 780), (430, 932)]:
        for old in (False, True):
            tag = f"{w}x{h} {'old' if old else 'fresh'}"
            ctx = b.new_context(viewport={"width": w, "height": h}, is_mobile=True, has_touch=True, device_scale_factor=2); pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            if old: pg.add_init_script(OLD)
            try:
                pg.goto(URL + "#play"); pg.wait_for_selector(".dopt", timeout=60000); pg.wait_for_timeout(600)
                tap_visible(pg, ".dopt[data-v=s1]", "deck tile"); pg.wait_for_timeout(300)
                tap_visible(pg, "[data-a=start]", "Start button"); pg.wait_for_selector(".coin", timeout=8000)
                # back to deck screen after starting, then start again (S.sel/deck selection must survive)
                pg.evaluate("location.hash='';"); pg.wait_for_timeout(500); pg.evaluate("location.hash='#play'"); pg.wait_for_timeout(800)
                if pg.locator(".coin,.gb,.mull").count():
                    pg.evaluate("LorcanaPlay.state().screen='menu';LorcanaPlay.state().st=null;LorcanaPlay.render()"); pg.wait_for_timeout(300)
                pg.wait_for_selector(".dopt", timeout=8000)
                tap_visible(pg, "[data-a=start]", "Start button (second time)"); pg.wait_for_selector(".coin", timeout=8000)
                if errs: raise Exception("JS errors: " + "; ".join(errs[:3]))
                print("ok  ", tag)
            except Exception as e:
                fails.append(tag); print("FAIL", tag, str(e).split("\n")[0][:200], errs[:2])
            ctx.close()
    b.close()
print("ui-start:", "FAILED " + ", ".join(fails) if fails else "all passed"); sys.exit(1 if fails else 0)
