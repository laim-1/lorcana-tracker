# Batch 7: deck builder tools — curve, import/export, validity, owned toggle
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
fails = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    ctx.add_init_script("localStorage.setItem('lorcanaPlaySettings.v1','{\"level\":\"easy\",\"speed\":\"fast\",\"tips\":false,\"style\":\"balanced\"}')")
    pg = ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL + "#play"); pg.wait_for_selector(".dopt", timeout=90000)
    pg.locator("[data-a=builder]").click(); pg.wait_for_selector("#bname", timeout=15000)
    if pg.locator(".curve").count() == 0: fails.append("cost curve missing")
    if pg.locator(".bbadge").count() == 0: fails.append("validity badge missing")
    if pg.locator(".bsplit").count() == 0: fails.append("ink/type split missing")
    if pg.locator("#bnotes").count() == 0: fails.append("deck notes missing")
    if pg.locator("[data-a=bowned]").count() == 0: fails.append("only-owned toggle missing")
    pg.locator("[data-a=btools]").click(); pg.wait_for_timeout(200)
    pg.locator("#sheet-body [data-a=bimport]").click(); pg.wait_for_selector("#bimptext", timeout=5000)
    sample = "\n".join([
      "3 Mickey Mouse - True Friend","2 Friends on the Other Side","2 Be Our Guest","2 HeiHei - Boat Snack",
      "2 Stitch - New Dog","2 Cinderella - Gentle and Kind","2 Hades - Lord of the Underworld",
      "2 Maximus - Relentless Pursuer","2 Minnie Mouse - Beloved Princess","1 Moana - Of Motunui",
      "2 Control Your Temper!","2 Hakuna Matata","1 Part of Your World","3 Dinglehopper",
      "2 Dr. Facilier - Charlatan","2 Jafar - Wicked Sorcerer","3 Magic Broom - Bucket Brigade",
      "2 Maleficent - Sorceress","2 Jetsam - Ursula's Spy","3 Olaf - Friendly Snowman",
      "2 Pascal - Rapunzel's Companion","3 Rafiki - Mysterious Sage","3 The Wardrobe - Belle's Confidant",
      "2 Yzma - Alchemist","1 Ariel - On Human Legs","1 Dr. Facilier - Agent Provocateur",
      "1 Flotsam - Ursula's Spy","1 Mickey Mouse - Wayward Sorcerer","1 Sven - Official Ice Deliverer",
    ])
    pg.fill("#bimptext", sample)
    pg.locator("#sheet-body [data-a=bimportgo][data-v=replace]").click()
    pg.wait_for_timeout(600)
    # dismiss unmatched if any
    if pg.locator("#sheet.open").count() and pg.locator("#sheet-body [data-a=close]").count():
        pg.locator("#sheet-body [data-a=close]").click(); pg.wait_for_timeout(200)
    n = pg.evaluate("()=>Object.values(LorcanaPlay.state().build.cards||{}).reduce((a,b)=>a+b,0)")
    if n < 50: fails.append(f"import too few cards: {n}")
    pg.locator("[data-a=btools]").click(); pg.wait_for_timeout(150)
    pg.locator("#sheet-body [data-a=bexport]").click(); pg.wait_for_selector("#bexptext", timeout=5000)
    exp = pg.input_value("#bexptext")
    if "Mickey Mouse" not in exp: fails.append("export missing Mickey")
    pg.locator("#sheet-body [data-a=close]").click(); pg.wait_for_timeout(150)
    pg.locator("[data-a=btools]").click(); pg.locator("#sheet-body [data-a=bhand]").click(); pg.wait_for_timeout(300)
    if pg.locator("#sheet-body .bcard").count() < 7: fails.append("sample hand <7")
    pg.locator("#sheet-body [data-a=close]").click()
    if pg.locator("[data-a=bsort][data-v=type]").count() == 0: fails.append("sort by type missing")
    if errs: fails.append("page errors: " + "; ".join(errs[:3]))
    b.close()
print("ui-batch7:", "FAILED " + " | ".join(fails) if fails else "passed")
sys.exit(1 if fails else 0)
