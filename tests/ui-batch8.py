# Batch 8 tracker: home tools, PWA links, set missing/quick/bulk chrome
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
fails = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg = ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_selector(".hactions", timeout=90000)
    pg.wait_for_timeout(400)
    for sel in [".hactions", "[data-go=search]", "[data-go=wish]", "[data-go=hist]", "[data-go=more]"]:
        if pg.locator(sel).count() == 0: fails.append("missing "+sel)
    man = pg.evaluate("()=>!!document.querySelector('link[rel=manifest]')")
    if not man: fails.append("manifest link missing")
    icon = pg.evaluate("()=>!!document.querySelector('link[rel=apple-touch-icon]')")
    if not icon: fails.append("apple-touch-icon missing")
    sid = pg.evaluate("()=>{const b=document.querySelector('.set[data-id]');return b&&b.dataset.id}")
    if not sid: fails.append("no set tiles")
    else:
        pg.evaluate("id=>location.hash='set/'+id", sid)
        pg.wait_for_function("()=>document.querySelector('#qatoon')||document.querySelector('.empty')", timeout=90000)
        pg.wait_for_timeout(400)
        for sel in ["#qatoon", "#bulk", "#missing", ".sumline"]:
            if pg.locator(sel).count() == 0: fails.append("set missing "+sel)
        if pg.locator("#missing").count():
            pg.locator("#missing").evaluate("e=>e.click()")
            pg.wait_for_selector("#sheet-body h4", timeout=5000)
            title = pg.locator("#sheet-body h4").inner_text()
            if "missing" not in title.lower(): fails.append("missing sheet title "+title)
            pg.evaluate("()=>{const b=document.querySelector('#sheet-body #done'); if(b)b.click()}")
            pg.wait_for_timeout(200)
    if errs: fails.append("page errors: "+", ".join(errs[:3]))
    b.close()
print("ui-batch8:", "FAILED " + " | ".join(fails) if fails else "passed")
sys.exit(1 if fails else 0)
