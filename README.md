# Lorcana Tracker

A mobile-first Disney Lorcana card collection tracker **and** unofficial fan game simulator. Browse every released set, see real card images, track normal and foil copies with TCGplayer market prices, build decks, and play vs AI (or pass-and-play) with main-set cards from sets 1–13.

- Live data from the [Lorcast API](https://lorcast.com/docs/api), with a bundled snapshot (`data/`) as an offline fallback
- Collection saved in your browser (localStorage), with JSON export/import
- Mobile-only UI: thick readable fonts, 44px tap targets, real/2D icon art (no emoji icons)
- Static site (no build step) via GitHub Pages: https://laim-1.github.io/lorcana-tracker/

Card images and data are © Disney / Ravensburger, provided via Lorcast. This is an unofficial fan project — not affiliated with Disney or Ravensburger.

![Sets](screenshots/screenshot-sets.png) ![Cards](screenshots/screenshot-cards.png)

## Deploying

Edit `index.html.tmpl` (not `index.html`), then run `tools/stamp.sh` before committing. It writes a new version into `index.html` (cache-busting `?v=` URLs) and `version.json`; open pages auto-reload once when a newer version is live.

## Tracker extras

Wishlist, global search, missing-to-complete pricing, value history chart / sparkline, price movers, duplicates/trade list, nearly complete sets, quick-add and bulk-own, backup reminder, shareable summary image, price/enchanted filters, and add-to-home-screen icons (`manifest.webmanifest`).

## Play mode

Tap **Play** on the home screen. Pick an official Ravensburger starter (exact decklists; regenerate with `node tools/gen-starters.js` from `tools/starters.txt`), auto-build from your collection, or use the deck builder (main sets 1–13; promo/special sets excluded).

Game extras: Easy/Normal/Hard AI with personalities, goldfish practice, pass-and-play, daily challenge, guided tutorial, one-step undo, save/resume, action log, SFX + volume + music, match history (filters / clear), rematch and rematch-with-swapped-decks, quick play (random starters).

Deck builder: Dreamborn import/export, cost curve (tap to filter), ink/type split, validity badge, owned-only toggle, sample hand, load official starter, duplicate / rename / delete, notes, price total.

The rules engine (`js/engine.js`) covers core rules and keywords; card text abilities are parsed into a pattern library. See `COVERAGE.md`. Overnight log: `OVERNIGHT.md`. Checklist: `BACKLOG.md`.

## Tests

```bash
node tests/engine.test.js
node tools/ai-table.js --a hard --b normal --games 40
python3 tests/ui-batch6.py http://127.0.0.1:8765
```
