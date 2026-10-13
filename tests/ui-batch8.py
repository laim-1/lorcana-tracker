# Batch 8 tracker: home tools, wishlist entry, set missing/quick/bulk chrome
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
fails = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg = ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_selector(".hactions, .set", timeout=90000)
    pg.wait_for_timeout(600)
    for sel in [".hactions", "[data-go=search]", "[data-go=wish]", "[data-go=hist]", "[data-go=more]"]:
        if pg.locator(sel).count() == 0: fails.append("missing "+sel)
    # manifest / icons linked
    man = pg.evaluate("()=>!!document.querySelector('link[rel=manifest]')")
    if not man: fails.append("manifest link missing")
    icon = pg.evaluate("()=>!!document.querySelector('link[rel=apple-touch-icon]')")
    if not icon: fails.append("apple-touch-icon missing")
    # open a set
    pg.locator(".set").first.click()
    pg.wait_for_selector(".grid .card, .empty, #qatoon", timeout=60000)
    pg.wait_for_timeout(500)
    for sel in ["#qatoon", "#bulk", "#missing", ".sumline"]:
        if pg.locator(sel).count() == 0: fails.append("set missing "+sel)
    pg.locator("#missing").click(); pg.wait_for_timeout(300)
    if pg.locator("#sheet-body h4").count() == 0: fails.append("missing sheet failed")
    pg.locator("#sheet-body #done, #sheet-body [data-a=close]").first.click() if pg.locator("#sheet-body #done").count() else None
    pg.wait_for_timeout(200)
    if pg.locator("#sheet-body #done").count():
        pg.locator("#sheet-body #done").click()
    if errs: fails.append("page errors: "+", ".join(errs[:3]))
    b.close()
print("ui-batch8:", "FAILED " + " | ".join(fails) if fails else "passed")
sys.exit(1 if fails else 0)
